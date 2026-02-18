import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Address, zeroAddress } from 'viem';
import { usePublicClient } from 'wagmi';
import { chainlinkAggregatorV3Abi } from '@/abis/chainlink-aggregator-v3';
import { formatOraclePrice, type FeedUpdateKind } from '@/utils/oracle';
import {
  isMetaOracleData,
  useOracleMetadata,
  type EnrichedFeed,
  type OracleMetadataRecord,
  type OracleOutputData,
} from '@/hooks/useOracleMetadata';
import type { SupportedNetworks } from '@/utils/networks';

const MAX_MULTICALL_FEEDS_PER_BATCH = 1000;
const FEED_REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_FEED_DECIMALS = 8;

type FeedSemanticHints = {
  derivedCandidate: boolean;
};

export type FeedSnapshot = {
  updatedAt: number | null;
  answerRaw: bigint | null;
  decimals: number | null;
  normalizedPrice: string | null;
  queryBlockTimestamp: number | null;
  updateKind: FeedUpdateKind;
};

export type FeedSnapshotByAddress = Record<string, FeedSnapshot>;
export type FeedLastUpdatedByAddress = FeedSnapshotByAddress;

function addNormalizedAddress(feedSet: Set<string>, address: string | null | undefined) {
  if (!address) return;
  const normalized = address.toLowerCase();
  if (normalized === zeroAddress) return;
  feedSet.add(normalized);
}

function isDerivedCandidateFeed(feed: EnrichedFeed): boolean {
  if (feed.pendleFeedKind || feed.pendleFeedSubtype) return true;
  const provider = feed.provider?.toLowerCase() ?? '';
  return provider.includes('pendle');
}

function addFeedAddress(feedSet: Set<string>, hintByAddress: Record<string, FeedSemanticHints>, feed: EnrichedFeed | null) {
  if (!feed?.address) return;
  const normalized = feed.address.toLowerCase();
  addNormalizedAddress(feedSet, normalized);

  const previous = hintByAddress[normalized];
  const nextDerivedCandidate = previous?.derivedCandidate === true || isDerivedCandidateFeed(feed);

  hintByAddress[normalized] = {
    derivedCandidate: nextDerivedCandidate,
  };
}

function addStandardOracleFeeds(
  feedSet: Set<string>,
  hintByAddress: Record<string, FeedSemanticHints>,
  oracleData: OracleOutputData | null,
) {
  if (!oracleData) return;

  addFeedAddress(feedSet, hintByAddress, oracleData.baseFeedOne);
  addFeedAddress(feedSet, hintByAddress, oracleData.baseFeedTwo);
  addFeedAddress(feedSet, hintByAddress, oracleData.quoteFeedOne);
  addFeedAddress(feedSet, hintByAddress, oracleData.quoteFeedTwo);
}

function getFeedDataFromMetadata(metadataRecord: OracleMetadataRecord | undefined): {
  addresses: string[];
  hintByAddress: Record<string, FeedSemanticHints>;
} {
  if (!metadataRecord) {
    return {
      addresses: [],
      hintByAddress: {},
    };
  }

  const feedSet = new Set<string>();
  const hintByAddress: Record<string, FeedSemanticHints> = {};

  for (const oracle of Object.values(metadataRecord)) {
    if (!oracle?.data) continue;

    if (isMetaOracleData(oracle.data)) {
      addStandardOracleFeeds(feedSet, hintByAddress, oracle.data.oracleSources.primary);
      addStandardOracleFeeds(feedSet, hintByAddress, oracle.data.oracleSources.backup);
      continue;
    }

    addStandardOracleFeeds(feedSet, hintByAddress, oracle.data);
  }

  return {
    addresses: Array.from(feedSet).sort(),
    hintByAddress,
  };
}

function createAddressFingerprint(addresses: string[]): string {
  if (addresses.length === 0) return '0';

  let hash = 2166136261;
  for (const address of addresses) {
    for (let index = 0; index < address.length; index += 1) {
      hash ^= address.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }

  return `${addresses.length}:${(hash >>> 0).toString(16)}`;
}

function createHintFingerprint(hintByAddress: Record<string, FeedSemanticHints>): string {
  const entries = Object.entries(hintByAddress).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return '0';

  let hash = 2166136261;
  for (const [address, hints] of entries) {
    const encoded = `${address}:${hints.derivedCandidate ? '1' : '0'}`;
    for (let index = 0; index < encoded.length; index += 1) {
      hash ^= encoded.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }

  return `${entries.length}:${(hash >>> 0).toString(16)}`;
}

function chunkAddresses(addresses: string[]): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < addresses.length; index += MAX_MULTICALL_FEEDS_PER_BATCH) {
    chunks.push(addresses.slice(index, index + MAX_MULTICALL_FEEDS_PER_BATCH));
  }

  return chunks;
}

export function useFeedLastUpdatedByChain(chainId: SupportedNetworks | number | undefined) {
  const publicClient = usePublicClient({ chainId });
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);

  const { addresses: feedAddresses, hintByAddress } = useMemo(() => getFeedDataFromMetadata(oracleMetadataMap), [oracleMetadataMap]);
  const addressFingerprint = useMemo(() => createAddressFingerprint(feedAddresses), [feedAddresses]);
  const hintFingerprint = useMemo(() => createHintFingerprint(hintByAddress), [hintByAddress]);

  const query = useQuery({
    queryKey: ['feed-snapshot', chainId, addressFingerprint, hintFingerprint],
    enabled: Boolean(chainId && publicClient && feedAddresses.length > 0),
    staleTime: FEED_REFRESH_INTERVAL_MS,
    refetchInterval: FEED_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<FeedSnapshotByAddress> => {
      if (!publicClient) return {};

      const snapshotByAddress: FeedSnapshotByAddress = {};
      const addressChunks = chunkAddresses(feedAddresses);
      const blockNumber = await publicClient.getBlockNumber();
      const block = await publicClient.getBlock({ blockNumber });
      const queryBlockTimestamp = Number(block.timestamp);

      for (const addressChunk of addressChunks) {
        const latestRoundContracts = addressChunk.map((feedAddress) => ({
          address: feedAddress as Address,
          abi: chainlinkAggregatorV3Abi,
          functionName: 'latestRoundData' as const,
        }));

        const decimalsContracts = addressChunk.map((feedAddress) => ({
          address: feedAddress as Address,
          abi: chainlinkAggregatorV3Abi,
          functionName: 'decimals' as const,
        }));

        const [roundResults, decimalsResults] = await Promise.all([
          publicClient.multicall({
            contracts: latestRoundContracts,
            allowFailure: true,
            blockNumber,
          }),
          publicClient.multicall({
            contracts: decimalsContracts,
            allowFailure: true,
            blockNumber,
          }),
        ]);

        for (let resultIndex = 0; resultIndex < roundResults.length; resultIndex += 1) {
          const result = roundResults[resultIndex];
          const feedAddress = addressChunk[resultIndex];
          if (!result || !feedAddress || result.status !== 'success') continue;

          const [, answer, , updatedAt] = result.result as readonly [bigint, bigint, bigint, bigint, bigint];
          const decimalsResult = decimalsResults[resultIndex];
          const decimals =
            decimalsResult?.status === 'success' && Number.isFinite(Number(decimalsResult.result))
              ? Number(decimalsResult.result)
              : DEFAULT_FEED_DECIMALS;

          const updatedAtSeconds = updatedAt > 0n ? Number(updatedAt) : null;
          const normalizedPrice = formatOraclePrice(answer, decimals);
          const isDerivedCandidate = hintByAddress[feedAddress]?.derivedCandidate === true;
          const updateKind: FeedUpdateKind =
            isDerivedCandidate && updatedAtSeconds != null && updatedAtSeconds === queryBlockTimestamp ? 'derived' : 'reported';

          snapshotByAddress[feedAddress] = {
            updatedAt: updatedAtSeconds,
            answerRaw: answer,
            decimals,
            normalizedPrice,
            queryBlockTimestamp,
            updateKind,
          };
        }
      }

      return snapshotByAddress;
    },
  });

  return {
    data: query.data ?? {},
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

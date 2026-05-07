import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { getClient } from '@/utils/rpc';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import { isSupportedNetwork, supportsHistoricalStateRead, type SupportedNetworks } from '@/utils/networks';
import { feedInspectorAbi } from '../feed-detail-abis';
import { PRICE_HISTORY_INTERVAL_SECONDS, PRICE_HISTORY_POINT_COUNT, PRICE_HISTORY_WINDOW_SECONDS } from '../feed-detail-constants';

const PRICE_HISTORY_READ_CONCURRENCY = 3;

export type FeedPriceHistoryPoint = {
  timestamp: number;
  targetTimestamp: number;
  blockNumber: number;
  price: number | null;
};

type EstimatedHistoryBlock = {
  blockNumber: number;
  timestamp: number;
  targetTimestamp: number;
};

function normalizeOracleAnswer(answer: bigint, decimals: number): number | null {
  if (answer <= 0n || decimals < 0) return null;
  const normalized = Number(answer) / 10 ** decimals;
  return Number.isFinite(normalized) ? normalized : null;
}

function buildPriceHistoryTargetTimestamps(latestTimestamp: number): number[] {
  return Array.from({ length: PRICE_HISTORY_POINT_COUNT }, (_, index) =>
    Math.round(latestTimestamp - PRICE_HISTORY_WINDOW_SECONDS + index * PRICE_HISTORY_INTERVAL_SECONDS),
  );
}

function buildEstimatedHistoryBlocks({
  chainId,
  targetTimestamps,
  latestBlockNumber,
  latestTimestamp,
}: {
  chainId: SupportedNetworks;
  targetTimestamps: number[];
  latestBlockNumber: number;
  latestTimestamp: number;
}): EstimatedHistoryBlock[] {
  return targetTimestamps.map((targetTimestamp) => ({
    blockNumber: estimateBlockAtTimestamp(chainId, targetTimestamp, latestBlockNumber, latestTimestamp),
    timestamp: targetTimestamp,
    targetTimestamp,
  }));
}

async function mapWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  mapper: (input: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(inputs.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(inputs[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

export function useFeedPriceHistory({
  address,
  chainId,
  decimals,
  enabled,
}: {
  address: Address | null;
  chainId: number;
  decimals: number | null;
  enabled: boolean;
}) {
  const supportedChainId = Number.isFinite(chainId) && isSupportedNetwork(chainId) ? (chainId as SupportedNetworks) : undefined;
  const { customRpcUrls } = useCustomRpcContext();
  const customRpcUrl = supportedChainId ? customRpcUrls[supportedChainId] : undefined;
  const canReadHistoricalState = supportedChainId ? supportsHistoricalStateRead(supportedChainId) : false;

  return useQuery({
    queryKey: [
      'feed-price-history',
      supportedChainId ?? 'unsupported',
      address?.toLowerCase() ?? null,
      decimals ?? null,
      customRpcUrl ?? null,
      PRICE_HISTORY_POINT_COUNT,
    ],
    queryFn: async (): Promise<FeedPriceHistoryPoint[]> => {
      if (!address || !supportedChainId || !canReadHistoricalState) return [];

      const client = getClient(supportedChainId, customRpcUrl);
      const resolvedDecimals =
        decimals ??
        (await client.readContract({
          address,
          abi: feedInspectorAbi,
          functionName: 'decimals',
        }));
      const latestBlock = await client.getBlock({ blockTag: 'latest' });
      if (latestBlock.number == null) return [];

      const latestBlockNumber = Number(latestBlock.number);
      const latestTimestamp = Number(latestBlock.timestamp);
      const targetTimestamps = buildPriceHistoryTargetTimestamps(latestTimestamp);
      const blocks = buildEstimatedHistoryBlocks({
        chainId: supportedChainId,
        targetTimestamps,
        latestBlockNumber,
        latestTimestamp,
      });

      const points = await mapWithConcurrency(blocks, PRICE_HISTORY_READ_CONCURRENCY, async (block) => {
        try {
          const roundData = await client.readContract({
            address,
            abi: feedInspectorAbi,
            functionName: 'latestRoundData',
            blockNumber: BigInt(block.blockNumber),
          });

          return {
            timestamp: block.timestamp,
            targetTimestamp: block.targetTimestamp,
            blockNumber: block.blockNumber,
            price: normalizeOracleAnswer(roundData[1], resolvedDecimals),
          };
        } catch {
          try {
            const answer = await client.readContract({
              address,
              abi: feedInspectorAbi,
              functionName: 'latestAnswer',
              blockNumber: BigInt(block.blockNumber),
            });

            return {
              timestamp: block.timestamp,
              targetTimestamp: block.targetTimestamp,
              blockNumber: block.blockNumber,
              price: normalizeOracleAnswer(answer, resolvedDecimals),
            };
          } catch {
            return {
              timestamp: block.timestamp,
              targetTimestamp: block.targetTimestamp,
              blockNumber: block.blockNumber,
              price: null,
            };
          }
        }
      });

      return points.sort((left, right) => left.timestamp - right.timestamp);
    },
    enabled: enabled && Boolean(address && supportedChainId && canReadHistoricalState),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

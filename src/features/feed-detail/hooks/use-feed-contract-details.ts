import { useMemo } from 'react';
import { type Address, isAddress, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { feedInspectorAbi, safeInspectorAbi, type LatestRoundData } from '../feed-detail-abis';
import { normalizeAddress } from '../feed-detail-utils';

function getReadResult<T>(results: unknown, index: number): T | null {
  if (!Array.isArray(results)) return null;
  const entry = results[index] as { status?: string; result?: unknown } | undefined;
  if (entry?.status !== 'success') return null;
  return entry.result as T;
}

function isUsableAddress(value: string | null | undefined): value is Address {
  return Boolean(value && isAddress(value) && normalizeAddress(value) !== normalizeAddress(zeroAddress));
}

export function useFeedContractDetails({
  feedAddress,
  chainId,
  isRouteSupported,
  isVaultDependency,
  isChainlinkFeed,
  oracleMetadataLoading,
}: {
  feedAddress: Address | null;
  chainId: number;
  isRouteSupported: boolean;
  isVaultDependency: boolean;
  isChainlinkFeed: boolean;
  oracleMetadataLoading: boolean;
}) {
  const feedContracts = useMemo(() => {
    if (!feedAddress || !isRouteSupported || oracleMetadataLoading || isVaultDependency) return [];
    const priceReadContracts = [
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestRoundData' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestAnswer' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestTimestamp' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'decimals' as const, chainId },
    ];

    if (!isChainlinkFeed) {
      return priceReadContracts;
    }

    return [
      ...priceReadContracts,
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'version' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'aggregator' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'owner' as const, chainId },
    ];
  }, [chainId, feedAddress, isChainlinkFeed, isRouteSupported, isVaultDependency, oracleMetadataLoading]);

  const { data: feedReadResults } = useReadContracts({
    contracts: feedContracts,
    allowFailure: true,
    query: {
      enabled: feedContracts.length > 0,
      staleTime: 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    },
  });

  const latestRoundData = getReadResult<LatestRoundData>(feedReadResults, 0);
  const latestAnswer = getReadResult<bigint>(feedReadResults, 1);
  const latestTimestamp = getReadResult<bigint>(feedReadResults, 2);
  const feedDecimalsRaw = getReadResult<number>(feedReadResults, 3);
  const version = getReadResult<bigint>(feedReadResults, 4);
  const aggregatorAddressRaw = getReadResult<string>(feedReadResults, 5);
  const ownerAddressRaw = getReadResult<string>(feedReadResults, 6);
  const aggregatorAddress =
    isChainlinkFeed &&
    !isVaultDependency &&
    isUsableAddress(aggregatorAddressRaw) &&
    normalizeAddress(aggregatorAddressRaw) !== normalizeAddress(feedAddress)
      ? aggregatorAddressRaw
      : null;
  const ownerAddress = isChainlinkFeed && !isVaultDependency && isUsableAddress(ownerAddressRaw) ? ownerAddressRaw : null;

  const safeContracts = useMemo(() => {
    if (!ownerAddress || !isChainlinkFeed || !isRouteSupported || isVaultDependency) return [];
    return [
      { address: ownerAddress, abi: safeInspectorAbi, functionName: 'getOwners' as const, chainId },
      { address: ownerAddress, abi: safeInspectorAbi, functionName: 'getThreshold' as const, chainId },
    ];
  }, [chainId, isChainlinkFeed, isRouteSupported, isVaultDependency, ownerAddress]);

  const { data: safeReadResults } = useReadContracts({
    contracts: safeContracts,
    allowFailure: true,
    query: {
      enabled: safeContracts.length > 0,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const safeOwners = getReadResult<readonly Address[]>(safeReadResults, 0);
  const safeThreshold = getReadResult<bigint>(safeReadResults, 1);
  const showChainlinkContractDetails =
    isChainlinkFeed && !isVaultDependency && (version != null || aggregatorAddress != null || ownerAddress != null || safeOwners != null);

  return {
    latestRoundData,
    latestAnswer,
    latestTimestamp,
    feedDecimalsRaw,
    version,
    aggregatorAddress,
    ownerAddress,
    safeOwners,
    safeThreshold,
    showChainlinkContractDetails,
  };
}

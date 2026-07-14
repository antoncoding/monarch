import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { UserVaultV2 } from '@/data-sources/monarch-api/vaults';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import { getEarningsTimeRange, usesCompletedUtcDays } from '@/utils/earnings-period';
import { supportsHistoricalStateRead, type SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { useCurrentBlocks } from './queries/useCurrentBlocks';
import { useBlockTimestamps } from './queries/useBlockTimestamps';

const ONE_SHARE = 10n ** 18n;

type VaultApyData = {
  actualApy: number;
  earnedAssets?: bigint;
  periodSeconds: number;
};

/**
 * Fetches historical APY for vaults by comparing share prices at the period boundaries.
 */
export const useVaultHistoricalApy = (vaults: UserVaultV2[], period: EarningsPeriod) => {
  const { customRpcUrls } = useCustomRpcContext();
  const range = useMemo(() => getEarningsTimeRange(period), [period]);
  const requiresHistoricalEnd = usesCompletedUtcDays(period);

  // Get unique chain IDs from vaults
  const uniqueChainIds = useMemo(() => [...new Set(vaults.map((v) => v.networkId))], [vaults]);

  // Get current blocks for each chain
  const { data: currentBlocks } = useCurrentBlocks(uniqueChainIds);

  // Estimate past blocks based on period
  const snapshotBlocks = useMemo(() => {
    if (!currentBlocks) return {};

    const blocks: Record<number, number> = {};

    for (const chainId of uniqueChainIds) {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, range.startTimestamp, currentBlock);
      }
    }

    return blocks;
  }, [range.startTimestamp, uniqueChainIds, currentBlocks]);

  const endSnapshotBlocks = useMemo(() => {
    if (!currentBlocks || !requiresHistoricalEnd) return {};

    const blocks: Record<number, number> = {};
    for (const chainId of uniqueChainIds) {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, range.endTimestamp, currentBlock);
      }
    }
    return blocks;
  }, [currentBlocks, range.endTimestamp, requiresHistoricalEnd, uniqueChainIds]);

  // Get actual timestamps for the snapshot blocks
  const { data: actualBlockData } = useBlockTimestamps(snapshotBlocks, range.startTimestamp, currentBlocks);
  const { data: endBlockData } = useBlockTimestamps(endSnapshotBlocks, range.endTimestamp, currentBlocks);

  // Create a stable key for the query
  const vaultAddresses = useMemo(
    () =>
      vaults
        .map((v) => v.address.toLowerCase())
        .sort()
        .join(','),
    [vaults],
  );

  return useQuery({
    queryKey: ['vault-historical-apy', vaultAddresses, range, actualBlockData, endBlockData],
    queryFn: async () => {
      if (!currentBlocks || !actualBlockData) {
        return new Map<string, VaultApyData>();
      }

      const results = new Map<string, VaultApyData>();
      const fallbackEndTimestamp = Math.floor(Date.now() / 1000);

      // Group vaults by network for efficient batching
      const vaultsByNetwork = vaults.reduce(
        (acc, vault) => {
          if (!acc[vault.networkId]) {
            acc[vault.networkId] = [];
          }
          acc[vault.networkId].push(vault);
          return acc;
        },
        {} as Record<SupportedNetworks, UserVaultV2[]>,
      );

      // Process each network in parallel
      await Promise.all(
        Object.entries(vaultsByNetwork).map(async ([networkIdStr, networkVaults]) => {
          const networkId = Number(networkIdStr) as SupportedNetworks;
          if (!supportsHistoricalStateRead(networkId)) {
            return;
          }

          const client = getClient(networkId, customRpcUrls[networkId]);
          const blockData = actualBlockData[networkId];
          const historicalEndBlockData = endBlockData?.[networkId];

          if (!blockData) {
            return;
          }

          const pastBlock = blockData.block;
          const endBlock = historicalEndBlockData?.block;
          const startTimestamp = blockData.timestamp;
          const endTimestamp = historicalEndBlockData?.timestamp ?? fallbackEndTimestamp;

          // Create multicall contracts for share price queries (same for current and past)
          const contracts = networkVaults.map((vault) => ({
            address: vault.address as Address,
            abi: vaultv2Abi,
            functionName: 'convertToAssets' as const,
            args: [ONE_SHARE],
          }));

          try {
            // Fetch current and past share prices in parallel
            const [currentResults, pastResults] = await Promise.all([
              client.multicall({
                contracts,
                allowFailure: true,
                blockNumber: endBlock ? BigInt(endBlock) : undefined,
              }),
              client.multicall({ contracts, allowFailure: true, blockNumber: BigInt(pastBlock) }),
            ]);

            // Calculate APY for each vault
            for (const [index, vault] of networkVaults.entries()) {
              const currentResult = currentResults[index];
              const pastResult = pastResults[index];

              if (currentResult.status === 'success' && pastResult.status === 'success' && currentResult.result && pastResult.result) {
                const currentSharePrice = currentResult.result as bigint;
                const pastSharePrice = pastResult.result as bigint;

                // Skip if past share price is 0 or current is less than past (shouldn't happen)
                if (pastSharePrice === 0n) {
                  continue;
                }

                // Calculate APY
                const periodSeconds = endTimestamp - startTimestamp;
                if (periodSeconds <= 0) {
                  continue;
                }

                const periodsPerYear = (365 * 86400) / periodSeconds;
                const priceRatio = Number(currentSharePrice) / Number(pastSharePrice);
                const apy = priceRatio ** periodsPerYear - 1;
                // vault.balance is current redeemable assets, not vault shares.
                const earnedAssets =
                  vault.balance && currentSharePrice >= pastSharePrice
                    ? (vault.balance * (currentSharePrice - pastSharePrice)) / currentSharePrice
                    : undefined;

                // Only include valid, non-negative APY
                if (Number.isFinite(apy) && apy >= 0) {
                  results.set(vault.address.toLowerCase(), { actualApy: apy, earnedAssets, periodSeconds });
                }
              }
            }
          } catch (error) {
            console.error(`Failed to fetch vault APY for network ${networkId}:`, error);
          }
        }),
      );

      return results;
    },
    enabled: vaults.length > 0 && !!currentBlocks && !!actualBlockData && (!requiresHistoricalEnd || !!endBlockData),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

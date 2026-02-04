import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { useCurrentBlocks } from './queries/useCurrentBlocks';
import { useBlockTimestamps } from './queries/useBlockTimestamps';
import { getPeriodTimestamp } from './usePositionsWithEarnings';

const ONE_SHARE = 10n ** 18n;

type VaultApyData = {
  actualApy: number;
};

/**
 * Fetches historical APY for vaults by comparing share prices at current and past blocks.
 * APY = (currentSharePrice / pastSharePrice) ^ (365 * 86400 / periodSeconds) - 1
 */
export const useVaultHistoricalApy = (vaults: UserVaultV2[], period: EarningsPeriod) => {
  const { customRpcUrls } = useCustomRpcContext();

  // Get unique chain IDs from vaults
  const uniqueChainIds = useMemo(() => [...new Set(vaults.map((v) => v.networkId))], [vaults]);

  // Get current blocks for each chain
  const { data: currentBlocks } = useCurrentBlocks(uniqueChainIds);

  // Estimate past blocks based on period
  const snapshotBlocks = useMemo(() => {
    if (!currentBlocks) return {};

    const timestamp = getPeriodTimestamp(period);
    const blocks: Record<number, number> = {};

    for (const chainId of uniqueChainIds) {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, timestamp, currentBlock);
      }
    }

    return blocks;
  }, [period, uniqueChainIds, currentBlocks]);

  // Get actual timestamps for the snapshot blocks
  const { data: actualBlockData } = useBlockTimestamps(snapshotBlocks);

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
    queryKey: ['vault-historical-apy', vaultAddresses, period, actualBlockData],
    queryFn: async () => {
      if (!currentBlocks || !actualBlockData) {
        return new Map<string, VaultApyData>();
      }

      const results = new Map<string, VaultApyData>();
      const endTimestamp = Math.floor(Date.now() / 1000);

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
          const client = getClient(networkId, customRpcUrls[networkId]);
          const pastBlock = snapshotBlocks[networkId];
          const blockData = actualBlockData[networkId];

          if (!pastBlock || !blockData) {
            return;
          }

          const startTimestamp = blockData.timestamp;

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
              client.multicall({ contracts, allowFailure: true }),
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

                // Only include valid, non-negative APY
                if (Number.isFinite(apy) && apy >= 0) {
                  results.set(vault.address.toLowerCase(), { actualApy: apy });
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
    enabled: vaults.length > 0 && !!currentBlocks && !!actualBlockData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

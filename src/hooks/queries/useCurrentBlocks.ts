import { useQuery } from '@tanstack/react-query';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

/**
 * Fetches current block numbers for the specified chains.
 *
 * This hook provides real-time block numbers that can be used for:
 * - Block estimation calculations
 * - Snapshot queries at current state
 * - Time-to-block conversions
 *
 * Cache behavior:
 * - staleTime: 30 seconds (blocks change frequently)
 * - gcTime: 60 seconds
 * - Refetches automatically when chains change
 *
 * @param chainIds - Array of chain IDs to fetch blocks for
 * @param customRpcUrls - Optional custom RPC URLs by chain ID
 * @returns React Query result with Record<chainId, blockNumber>
 *
 * @example
 * ```tsx
 * const { data: currentBlocks } = useCurrentBlocks([1, 8453], customRpcUrls);
 * // currentBlocks = { 1: 12345678, 8453: 9876543 }
 * ```
 */
export const useCurrentBlocks = (
  chainIds: SupportedNetworks[],
  customRpcUrls?: Record<number, string | undefined>,
) => {
  return useQuery({
    queryKey: ['current-blocks', chainIds.sort().join(',')],
    queryFn: async () => {
      const blocks: Record<number, number> = {};

      await Promise.all(
        chainIds.map(async (chainId) => {
          try {
            const client = getClient(chainId, customRpcUrls?.[chainId]);
            const blockNumber = await client.getBlockNumber();
            blocks[chainId] = Number(blockNumber);
          } catch (error) {
            console.error(`Failed to get current block for chain ${chainId}:`, error);
          }
        }),
      );

      return blocks;
    },
    enabled: chainIds.length > 0,
    staleTime: 30_000, // 30 seconds
    gcTime: 60_000, // 1 minute
  });
};

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';

/**
 * Estimates and fetches blocks at a specific timestamp across multiple chains.
 *
 * Two-step process:
 * 1. Client-side estimation using estimateBlockAtTimestamp (instant)
 * 2. On-chain verification by fetching actual block timestamps
 *
 * This ensures accurate time ranges for historical queries while providing
 * fast initial estimates.
 *
 * Cache behavior:
 * - staleTime: 5 minutes (historical blocks don't change)
 * - gcTime: 10 minutes
 * - Only runs when currentBlocks are available
 *
 * @param timestamp - Target timestamp (seconds since epoch)
 * @param chainIds - Array of chain IDs to estimate blocks for
 * @param currentBlocks - Current block numbers from useCurrentBlocks
 * @param customRpcUrls - Optional custom RPC URLs by chain ID
 * @returns React Query result with Record<chainId, { block, timestamp }>
 *
 * @example
 * ```tsx
 * const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
 * const { data: blocks } = useBlocksAtTimestamp(
 *   oneDayAgo,
 *   [1, 8453],
 *   currentBlocks,
 *   customRpcUrls
 * );
 * // blocks = {
 * //   1: { block: 12340000, timestamp: 1234567890 },
 * //   8453: { block: 9870000, timestamp: 1234567892 }
 * // }
 * ```
 */
export const useBlocksAtTimestamp = (
  timestamp: number,
  chainIds: SupportedNetworks[],
  currentBlocks: Record<number, number> | undefined,
  customRpcUrls?: Record<number, string | undefined>,
) => {
  // Step 1: Client-side estimation (instant, no RPC calls)
  const estimatedBlocks = useMemo(() => {
    if (!currentBlocks) return {};

    const blocks: Record<number, number> = {};
    chainIds.forEach((chainId) => {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, timestamp, currentBlock);
      }
    });

    return blocks;
  }, [timestamp, chainIds, currentBlocks]);

  // Step 2: Fetch actual blocks to verify timestamps
  return useQuery({
    queryKey: ['blocks-at-timestamp', timestamp, chainIds.sort().join(',')],
    queryFn: async () => {
      const blockData: Record<number, { block: number; timestamp: number }> = {};

      await Promise.all(
        Object.entries(estimatedBlocks).map(async ([chainId, blockNum]) => {
          try {
            const client = getClient(
              Number(chainId) as SupportedNetworks,
              customRpcUrls?.[Number(chainId) as SupportedNetworks],
            );
            const block = await client.getBlock({ blockNumber: BigInt(blockNum) });
            blockData[Number(chainId)] = {
              block: blockNum,
              timestamp: Number(block.timestamp),
            };
          } catch (error) {
            console.error(`Failed to get block ${blockNum} on chain ${chainId}:`, error);
          }
        }),
      );

      return blockData;
    },
    enabled: !!currentBlocks && Object.keys(estimatedBlocks).length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

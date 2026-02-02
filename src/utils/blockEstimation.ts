import type { PublicClient } from 'viem';
import { type SupportedNetworks, getBlocktime } from './networks';

export type BlockWithTimestamp = {
  blockNumber: number;
  timestamp: number; // actual block timestamp in seconds
  targetTimestamp: number; // original target timestamp used for estimation
};

/**
 * Estimates the block number at a given timestamp using average block times.
 * This provides a quick approximation that's then refined by fetching the actual block timestamp.
 *
 * @param chainId - The chain ID to estimate for
 * @param targetTimestamp - The Unix timestamp (in seconds) to estimate the block for
 * @param currentBlock - The current block number on the chain
 * @param currentTimestamp - The current Unix timestamp (in seconds), defaults to now
 * @returns The estimated block number at the target timestamp
 *
 * @example
 * // Estimate block number 24 hours ago
 * const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
 * const estimatedBlock = estimateBlockAtTimestamp(
 *   SupportedNetworks.Mainnet,
 *   oneDayAgo,
 *   19000000
 * );
 * // Returns approximately 19000000 - 7200 (24h / 12s per block)
 */
export const estimateBlockAtTimestamp = (
  chainId: SupportedNetworks,
  targetTimestamp: number,
  currentBlock: number,
  currentTimestamp: number = Math.floor(Date.now() / 1000),
): number => {
  const timeDiff = currentTimestamp - targetTimestamp;
  const blockTime = getBlocktime(chainId); // Use existing utility from networks.ts
  const blockDiff = Math.floor(timeDiff / blockTime);

  // Ensure we don't return negative block numbers
  return Math.max(0, currentBlock - blockDiff);
};

/**
 * Fetches real block timestamps for multiple estimated blocks in parallel.
 * Uses batched RPC calls for efficiency.
 *
 * @param client - The viem PublicClient
 * @param chainId - The chain ID
 * @param targetTimestamps - Array of target timestamps to find blocks for
 * @param currentBlock - Current block number
 * @param currentTimestamp - Current timestamp in seconds
 * @returns Array of BlockWithTimestamp containing real block timestamps
 */
export async function fetchBlocksWithTimestamps(
  client: PublicClient,
  chainId: SupportedNetworks,
  targetTimestamps: number[],
  currentBlock: number,
  currentTimestamp: number,
): Promise<BlockWithTimestamp[]> {
  // First, estimate all block numbers
  const estimatedBlocks = targetTimestamps.map((ts) =>
    estimateBlockAtTimestamp(chainId, ts, currentBlock, currentTimestamp),
  );

  // Fetch all block timestamps in parallel
  const blockPromises = estimatedBlocks.map(async (blockNum, index) => {
    try {
      const block = await client.getBlock({ blockNumber: BigInt(blockNum) });
      return {
        blockNumber: blockNum,
        timestamp: Number(block.timestamp),
        targetTimestamp: targetTimestamps[index],
      };
    } catch {
      // If block fetch fails (shouldn't happen for valid blocks), use estimated timestamp
      return {
        blockNumber: blockNum,
        timestamp: targetTimestamps[index],
        targetTimestamp: targetTimestamps[index],
      };
    }
  });

  return Promise.all(blockPromises);
}

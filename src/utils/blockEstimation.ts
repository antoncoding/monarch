import { type SupportedNetworks, getBlocktime } from './networks';

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

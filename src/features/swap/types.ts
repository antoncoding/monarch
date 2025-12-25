import type { Address } from 'viem';

/**
 * Token information with optional balance
 */
export type SwapToken = {
  address: Address;
  symbol: string;
  chainId: number;
  decimals: number;
  balance?: bigint;
};

/**
 * Quote display information
 */
export type SwapQuoteDisplay = {
  type: 'same-chain' | 'cross-chain';
  buyAmount: bigint;

  // Cross-chain specific fields
  bridgeProvider?: string;
  bridgeFee?: bigint;
  estimatedTimeSeconds?: number;
  destinationGasFee?: bigint;
};

/**
 * CoW Protocol supported chains for bridging
 * Mainnet (1), Base (8453), Polygon (137), Arbitrum (42161)
 */
export const COW_BRIDGE_CHAINS = [1, 8453, 137, 42_161] as const;

/**
 * Type for CoW bridge supported chain IDs
 */
export type CowBridgeChainId = (typeof COW_BRIDGE_CHAINS)[number];

/**
 * Check if a chain ID is supported by CoW Bridge
 */
export function isCowBridgeChain(chainId: number): chainId is CowBridgeChainId {
  return COW_BRIDGE_CHAINS.includes(chainId as CowBridgeChainId);
}

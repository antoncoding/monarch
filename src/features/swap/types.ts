/**
 * Token information with optional balance
 */
export type SwapToken = {
  address: string;
  symbol: string;
  chainId: number;
  decimals: number;
  balance?: bigint;
  img?: string;
};

/**
 * Quote display information for same-chain swaps
 */
export type SwapQuoteDisplay = {
  buyAmount: bigint;
  sellAmount: bigint;
};

/**
 * Velora supported chains that overlap with Monarch-supported networks.
 * Mainnet (1), Polygon (137), Unichain (130), Base (8453), Arbitrum (42161)
 */
export const VELORA_SWAP_CHAINS = [1, 137, 130, 8453, 42_161] as const;

/**
 * Canonical native-token pseudo address used by Velora API.
 */
export const VELORA_NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;

/**
 * Type for Velora swap supported chain IDs
 */
export type VeloraSwapChainId = (typeof VELORA_SWAP_CHAINS)[number];

/**
 * Check if a chain ID is supported by Velora swap
 */
export function isVeloraSwapChain(chainId: number): chainId is VeloraSwapChainId {
  return VELORA_SWAP_CHAINS.includes(chainId as VeloraSwapChainId);
}

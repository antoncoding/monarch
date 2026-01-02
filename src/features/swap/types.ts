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
 * CoW Protocol supported chains for swaps
 * Mainnet (1), Base (8453), Arbitrum (42161)
 * Note: These are chains supported by both CoW Protocol and our balance API
 */
export const COW_SWAP_CHAINS = [1, 8453, 42_161] as const;

/**
 * CoW Protocol VaultRelayer address (same across all chains)
 * This is the address that needs to be approved to spend tokens
 */
export const COW_VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110' as const;

/**
 * Type for CoW swap supported chain IDs
 */
export type CowSwapChainId = (typeof COW_SWAP_CHAINS)[number];

/**
 * Check if a chain ID is supported by CoW Swap
 */
export function isCowSwapChain(chainId: number): chainId is CowSwapChainId {
  return COW_SWAP_CHAINS.includes(chainId as CowSwapChainId);
}

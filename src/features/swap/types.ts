/**
 * Token information with optional balance
 */
export type SwapToken = {
  address: string;
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
  sellAmount: bigint;

  // Cross-chain specific fields
  bridgeProvider?: string;
  bridgeFee?: bigint;
  estimatedTimeSeconds?: number;
  destinationGasFee?: bigint;
};

/**
 * CoW Protocol supported chains for bridging
 * Only chains supported by our API: Mainnet (1), Base (8453), Polygon (137), Arbitrum (42161)
 * Note: Gnosis (100) removed - not supported by balance API
 */
export const COW_BRIDGE_CHAINS = [1, 8453, 137, 42_161] as const;

/**
 * CoW Protocol VaultRelayer address (same across all chains)
 * This is the address that needs to be approved to spend tokens
 */
export const COW_VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110' as const;

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

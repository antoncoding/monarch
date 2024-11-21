import { SupportedNetworks } from '@/utils/networks';

/**
 * Represents a token with fixed network and address information
 * Used for consistent token identification across the application
 */
export type NetworkToken = {
  /** Token symbol (e.g., "WETH", "USDC") */
  symbol: string;
  /** Token decimals for amount formatting */
  decimals: number;
  /** Network address where this token exists */
  network: SupportedNetworks;
  /** Token contract address on the network */
  address: string;
};

import { isAddress, type Address } from 'viem';
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

/** Canonical token addresses used for deterministic route checks. */
export const WETH_BY_CHAIN: Partial<Record<SupportedNetworks, Address>> = {
  [SupportedNetworks.Mainnet]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [SupportedNetworks.Base]: '0x4200000000000000000000000000000000000006',
  [SupportedNetworks.Polygon]: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  [SupportedNetworks.Unichain]: '0x4200000000000000000000000000000000000006',
  [SupportedNetworks.Arbitrum]: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  [SupportedNetworks.Monad]: '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242',
};

export const getCanonicalWethAddress = (chainId: number): Address | undefined => {
  return WETH_BY_CHAIN[chainId as SupportedNetworks];
};

/**
 * Normalizes an address for canonical token identity checks.
 * Returns null when the input is not a valid EVM address.
 */
export const toCanonicalTokenAddress = (address: string | null | undefined): Address | null => {
  if (!address || !isAddress(address)) return null;
  return address.toLowerCase() as Address;
};

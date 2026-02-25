import type { Address } from 'viem';
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

/**
 * Canonical token addresses used for deterministic route checks.
 * These are intentionally explicit to avoid relying on optional
 * contract introspection methods for route discovery.
 */
export const WETH_BY_CHAIN: Partial<Record<SupportedNetworks, Address>> = {
  [SupportedNetworks.Mainnet]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [SupportedNetworks.Base]: '0x4200000000000000000000000000000000000006',
  [SupportedNetworks.Polygon]: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  [SupportedNetworks.Unichain]: '0x4200000000000000000000000000000000000006',
  [SupportedNetworks.Arbitrum]: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  [SupportedNetworks.Monad]: '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242',
};

export const WSTETH_BY_CHAIN: Partial<Record<SupportedNetworks, Address>> = {
  [SupportedNetworks.Mainnet]: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  [SupportedNetworks.Base]: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452',
  [SupportedNetworks.Unichain]: '0xc02fe7317d4eb8753a02c35fe019786854a92001',
  [SupportedNetworks.Arbitrum]: '0x5979D7b546E38E414F7E9822514be443A4800529',
  [SupportedNetworks.Monad]: '0x10Aeaf63194db8d453d4D85a06E5eFE1dd0b5417',
};

export const STETH_BY_CHAIN: Partial<Record<SupportedNetworks, Address>> = {
  [SupportedNetworks.Mainnet]: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
};

export const getCanonicalWethAddress = (chainId: number): Address | undefined => {
  return WETH_BY_CHAIN[chainId as SupportedNetworks];
};

export const getCanonicalWstEthAddress = (chainId: number): Address | undefined => {
  return WSTETH_BY_CHAIN[chainId as SupportedNetworks];
};

export const getCanonicalStEthAddress = (chainId: number): Address | undefined => {
  return STETH_BY_CHAIN[chainId as SupportedNetworks];
};

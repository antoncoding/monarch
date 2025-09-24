import { isSupportedChain, SupportedNetworks } from '@/utils/networks';
import arbitrumRawData from './arbitrum.json'
import baseRawData from './base.json';
import mainnetRawData from './mainnet.json';
import polygonRawData from './polygon.json';
import { ChainlinkOracleEntry } from './types';

export const CHAINLINK_ORACLES = {
  [SupportedNetworks.Mainnet]: mainnetRawData as ChainlinkOracleEntry[],
  [SupportedNetworks.Base]: baseRawData as ChainlinkOracleEntry[],
  [SupportedNetworks.Polygon]: polygonRawData as ChainlinkOracleEntry[],
  [SupportedNetworks.Arbitrum]: arbitrumRawData as ChainlinkOracleEntry[],
  [SupportedNetworks.Unichain]: [] as ChainlinkOracleEntry[],
} as const;

export const getAllOracles = (): Record<SupportedNetworks, ChainlinkOracleEntry[]> =>
  CHAINLINK_ORACLES;

export const getOracleByPath = (
  chain: keyof typeof CHAINLINK_ORACLES,
  path: string,
): ChainlinkOracleEntry | undefined => {
  return CHAINLINK_ORACLES[chain].find((oracle) => oracle.path === path);
};

export const isChainlinkOracle = (chainId: number, address: string): boolean => {
  if (!isSupportedChain(chainId) || !address) return false;
  const network = chainId as SupportedNetworks;
  return CHAINLINK_ORACLES[network].some(
    (oracle) => oracle.proxyAddress.toLowerCase() === address.toLowerCase(),
  );
};

export const getChainlinkOracle = (
  chainId: number,
  address: string,
): ChainlinkOracleEntry | undefined => {
  if (!isSupportedChain(chainId) || !address) return undefined;
  const network = chainId as SupportedNetworks;
  return CHAINLINK_ORACLES[network].find(
    (oracle) => oracle.proxyAddress.toLowerCase() === address.toLowerCase(),
  );
};

export const getChainlinkFeedUrl = (chainId: number, ens: string): string => {
  if (chainId === SupportedNetworks.Mainnet) {
    return `https://data.chain.link/feeds/ethereum/mainnet/${ens}`;
  }
  if (chainId === SupportedNetworks.Base) {
    return `https://data.chain.link/feeds/base/base/${ens}`;
  }
  if (chainId === SupportedNetworks.Polygon) {
    return `https://data.chain.link/feeds/polygon/mainnet/${ens}`;
  }
  if (chainId === SupportedNetworks.Arbitrum) {
    return `https://data.chain.link/feeds/arbitrum/mainnet/${ens}`
  }
  return '';
};

export * from './types';

import { isSupportedChain, SupportedNetworks } from '@/utils/networks';
import arbitrumRawData from './arbitrum.json';
import baseRawData from './base.json';
import hyperevmRawData from './hyperevm.json';
import mainnetRawData from './mainnet.json';
import monadRawData from './monad.json';
import polygonRawData from './polygon.json';
import { RedstoneOracleEntry } from './types';
import unichainRawData from './unichain.json';

export const REDSTONE_ORACLES = {
  [SupportedNetworks.Mainnet]: mainnetRawData as RedstoneOracleEntry[],
  [SupportedNetworks.Base]: baseRawData as RedstoneOracleEntry[],
  [SupportedNetworks.Polygon]: polygonRawData as RedstoneOracleEntry[],
  [SupportedNetworks.Arbitrum]: arbitrumRawData as RedstoneOracleEntry[],
  [SupportedNetworks.Unichain]: unichainRawData as RedstoneOracleEntry[],
  [SupportedNetworks.HyperEVM]: hyperevmRawData as RedstoneOracleEntry[],
  [SupportedNetworks.Monad]: monadRawData as RedstoneOracleEntry[],
} as const;

export const getAllRedstoneOracles = (): Record<
  SupportedNetworks,
  RedstoneOracleEntry[]
> => REDSTONE_ORACLES;

export const getRedstoneOracleByPath = (
  chain: keyof typeof REDSTONE_ORACLES,
  path: string,
): RedstoneOracleEntry | undefined => {
  return REDSTONE_ORACLES[chain].find((oracle) => oracle.path === path);
};

export const isRedstoneOracle = (chainId: number, address: string): boolean => {
  if (!isSupportedChain(chainId) || !address) return false;
  const network = chainId as SupportedNetworks;
  return REDSTONE_ORACLES[network].some(
    (oracle) => oracle.priceFeedAddress.toLowerCase() === address.toLowerCase(),
  );
};

export const getRedstoneOracle = (
  chainId: number,
  address: string,
): RedstoneOracleEntry | undefined => {
  if (!isSupportedChain(chainId) || !address) return undefined;
  const network = chainId as SupportedNetworks;
  return REDSTONE_ORACLES[network].find(
    (oracle) => oracle.priceFeedAddress.toLowerCase() === address.toLowerCase(),
  );
};

export * from './types';

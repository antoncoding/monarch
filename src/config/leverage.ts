import type { Address } from 'viem';
import { getBundlerV2 } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { MONARCH_FEE_RECIPIENT } from './smart-rebalance';

/**
 * Transfer fee for leverage flows.
 *
 * Uses the same fee recipient as Smart Rebalance so all Monarch fees route to
 * a single address.
 */
export const LEVERAGE_FEE_RECIPIENT = MONARCH_FEE_RECIPIENT;

type SpecialErc4626LeverageConfig = {
  marketUniqueKey: string;
  bundler: Address;
  warningStorageKey: string;
  warningMessage: string;
};

const SPECIAL_ERC4626_LEVERAGE_CONFIG_BY_CHAIN: Partial<Record<SupportedNetworks, SpecialErc4626LeverageConfig>> = {
  1: {
    marketUniqueKey: '0xacc49fbf58feb1ac971acce68f8adc177c43682d6a7087bbd4991a05cb7a2c67',
    bundler: '0xaB27431E62ead49A40848958A6BaDA040BA2264f',
    warningStorageKey: 'monarch_special_erc4626_bundler_warning_ack_mainnet',
    warningMessage:
      'Leveraging this market through ERC4626 deposit uses a whitelist-based bundler developed by Royco. Proceed only if you trust this contract.',
  },
};

export const getSpecialErc4626LeverageConfig = (chainId: SupportedNetworks): SpecialErc4626LeverageConfig | null =>
  SPECIAL_ERC4626_LEVERAGE_CONFIG_BY_CHAIN[chainId] ?? null;

export const isSpecialErc4626LeverageMarket = (chainId: SupportedNetworks, marketUniqueKey: string): boolean => {
  const specialConfig = getSpecialErc4626LeverageConfig(chainId);
  if (!specialConfig) return false;
  return marketUniqueKey.toLowerCase() === specialConfig.marketUniqueKey;
};

export const resolveErc4626RouteBundler = (chainId: SupportedNetworks, marketUniqueKey: string): Address => {
  const specialConfig = getSpecialErc4626LeverageConfig(chainId);
  if (specialConfig && marketUniqueKey.toLowerCase() === specialConfig.marketUniqueKey) return specialConfig.bundler;
  return getBundlerV2(chainId) as Address;
};

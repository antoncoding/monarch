import type { Address } from 'viem';
import { MONARCH_FEE_RECIPIENT } from './smart-rebalance';

/**
 * Transfer fee for leverage flows.
 *
 * Uses the same fee recipient as Smart Rebalance so all Monarch fees route to
 * a single address.
 */
export const LEVERAGE_FEE_RECIPIENT = MONARCH_FEE_RECIPIENT;

const SPECIAL_ERC4626_LEVERAGE_MARKET_UNIQUE_KEY_CONFIG = '0xacc49fbf58feb1ac971acce68f8adc177c43682d6a7087bbd4991a05cb7a2c67';
const SPECIAL_ERC4626_LEVERAGE_BUNDLER_CONFIG = '0xaB27431E62ead49A40848958A6BaDA040BA2264f';

export const SPECIAL_ERC4626_LEVERAGE_CONFIG = {
  marketUniqueKey: SPECIAL_ERC4626_LEVERAGE_MARKET_UNIQUE_KEY_CONFIG,
  bundler: SPECIAL_ERC4626_LEVERAGE_BUNDLER_CONFIG as Address,
  warningStorageKey: 'monarch_special_erc4626_bundler_warning_ack',
  warningMessage:
    'Leveraging this market through ERC4626 deposit uses a whitelist-based bundler developed by Royco. Proceed only if you trust this contract.',
} as const;

export const isSpecialErc4626LeverageMarket = (marketUniqueKey: string): boolean =>
  marketUniqueKey.toLowerCase() === SPECIAL_ERC4626_LEVERAGE_CONFIG.marketUniqueKey;

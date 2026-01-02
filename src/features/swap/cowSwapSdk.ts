import { TradingSdk } from '@cowprotocol/cow-sdk';
import { SWAP_APP_CODE } from './constants';

/**
 * CoW Protocol Trading SDK for same-chain swaps
 * Handles quotes, order signing, and posting
 */
export const tradingSdk = new TradingSdk(
  {
    chainId: 1, // Default, will be updated per swap
    appCode: SWAP_APP_CODE,
  },
  {
    enableLogging: false,
  },
);

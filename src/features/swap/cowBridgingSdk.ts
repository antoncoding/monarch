import { TradingSdk } from '@cowprotocol/cow-sdk';
import { BridgingSdk, BungeeBridgeProvider } from '@cowprotocol/sdk-bridging';
import { SWAP_APP_CODE } from './constants';

/**
 * Trading SDK for approvals and allowances
 */
export const tradingSdk = new TradingSdk(
  {
    chainId: 1, // Default, will be updated by adapter
    appCode: SWAP_APP_CODE,
  },
  {},
);

/**
 * Bungee bridge provider configuration
 * Supports Across and CCTP bridges for fast, reliable cross-chain swaps
 */
export const bungeeBridgeProvider = new BungeeBridgeProvider({
  apiOptions: {
    includeBridges: ['across', 'cctp'],
  },
});

/**
 * CoW Protocol BridgingSDK instance
 * Handles both same-chain swaps and cross-chain bridging automatically
 */
export const bridgingSdk = new BridgingSdk(
  {
    providers: [bungeeBridgeProvider],
    tradingSdk, // Pass TradingSdk for approvals
    enableLogging: false, // Set to true for debugging
  },
  undefined,
);

import { BridgingSdk, BungeeBridgeProvider } from '@cowprotocol/cow-sdk';

/**
 * Bungee bridge provider configuration
 * Supports Across and CCTP bridges for fast, reliable cross-chain swaps
 */
export const bungeeBridgeProvider = new BungeeBridgeProvider({
  apiOptions: {
    includeBridges: ['across', 'cctp'], // Fast and reliable bridge providers
  },
});

/**
 * CoW Protocol BridgingSDK instance
 * Handles both same-chain swaps and cross-chain bridging automatically
 */
export const bridgingSdk = new BridgingSdk({
  providers: [bungeeBridgeProvider],
  enableLogging: false, // Set to true for debugging
});

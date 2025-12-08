import type { Address } from 'viem';
import priceFeedsData from './price-feeds.json';
import type { GeneralPriceFeed } from './types';

// Import the JSON data with proper typing (from Morpho's official API data)
const generalPriceFeeds: GeneralPriceFeed[] = priceFeedsData as GeneralPriceFeed[];

/**
 * Check if a feed address is in the general price feeds dataset
 * @param feedAddress - The feed contract address
 * @param chainId - The chain ID
 * @returns boolean
 */
export function isGeneralFeed(feedAddress: Address | string, chainId: number): boolean {
  const address = feedAddress.toLowerCase();
  return generalPriceFeeds.some((feed) => feed.address.toLowerCase() === address && feed.chainId === chainId);
}

/**
 * Get general price feed data by address and chain ID
 * @param feedAddress - The feed contract address
 * @param chainId - The chain ID
 * @returns GeneralPriceFeed or undefined if not found
 */
export function getGeneralFeed(feedAddress: Address | string, chainId: number): GeneralPriceFeed | undefined {
  const address = feedAddress.toLowerCase();
  return generalPriceFeeds.find((feed) => feed.address.toLowerCase() === address && feed.chainId === chainId);
}

import type { Market } from '@/utils/types';

export const MARKET_DISCOVERY_CATEGORIES = ['newOpportunities', 'trending', 'popular'] as const;
export const MARKET_DISCOVERY_MIN_MARKET_SIZE_USD = 50_000;

export type MarketDiscoveryCategory = (typeof MARKET_DISCOVERY_CATEGORIES)[number];

export const MARKET_DISCOVERY_CATEGORY_META: Record<
  MarketDiscoveryCategory,
  {
    label: string;
    shortLabel: string;
  }
> = {
  newOpportunities: {
    label: 'New opportunities',
    shortLabel: 'New',
  },
  trending: {
    label: 'Growing',
    shortLabel: 'Growing',
  },
  popular: {
    label: 'Popular',
    shortLabel: 'Popular',
  },
};

export const getMarketDiscoveryKey = (chainId: number, uniqueKey: string): string => `${chainId}-${uniqueKey.toLowerCase()}`;

export const getMarketDiscoverySizeUsd = (market: Market): number => {
  const supplyUsd = Number(market.state?.supplyAssetsUsd ?? 0);
  const borrowUsd = Number(market.state?.borrowAssetsUsd ?? 0);
  return Math.max(supplyUsd, borrowUsd);
};

export const isMarketDiscoveryEligible = (market: Market): boolean =>
  getMarketDiscoverySizeUsd(market) >= MARKET_DISCOVERY_MIN_MARKET_SIZE_USD;

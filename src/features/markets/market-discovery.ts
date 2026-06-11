export const MARKET_DISCOVERY_CATEGORIES = ['newOpportunities', 'trending', 'popular'] as const;

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
    label: 'Trending',
    shortLabel: 'Trend',
  },
  popular: {
    label: 'Popular',
    shortLabel: 'Popular',
  },
};

export const getMarketDiscoveryKey = (chainId: number, uniqueKey: string): string => `${chainId}-${uniqueKey.toLowerCase()}`;

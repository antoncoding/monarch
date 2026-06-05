import type { SupportedNetworks } from '@/utils/networks';

export const getMarketDetailCacheKey = (chainId: SupportedNetworks | number, marketUniqueKey: string): string =>
  `${chainId}:${marketUniqueKey.toLowerCase()}`;

import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import type { Market, MarketMetadata } from '@/utils/types';

export const toIndexedMarket = (market: Market): Market => {
  return {
    ...market,
    warnings: [],
    supplyingVaults: [],
  };
};

export const applyMarketMetadata = (market: Market, metadata: MarketMetadata | null | undefined): Market => {
  if (!metadata) {
    return market;
  }

  return {
    ...market,
    warnings: metadata.warnings,
    supplyingVaults: metadata.supplyingVaults,
  };
};

export const applyMarketMetadataMap = (markets: Market[], metadataMap: ReadonlyMap<string, MarketMetadata>): Market[] => {
  if (markets.length === 0 || metadataMap.size === 0) {
    return markets;
  }

  return markets.map((market) =>
    applyMarketMetadata(
      market,
      metadataMap.get(getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id)),
    ),
  );
};

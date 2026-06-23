import { useMemo } from 'react';
import { useMorphoWhitelistStatusQuery } from '@/hooks/queries/useMorphoWhitelistStatusQuery';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useUsdEnrichedMarkets } from '@/hooks/useUsdEnrichedMarkets';
import { getAssetBlacklistKey, useBlacklistedAssets } from '@/stores/useBlacklistedAssets';
import { useBlacklistedMarkets } from '@/stores/useBlacklistedMarkets';
import { useAppSettings } from '@/stores/useAppSettings';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { isForceUnwhitelisted, isMarketVisibleWithWhitelistGuard } from '@/utils/markets';
import type { Market } from '@/utils/types';

type UseProcessedMarketsOptions = {
  enabled?: boolean;
  marketsRefetchInterval?: number | false;
  marketsRefetchOnWindowFocus?: boolean;
  enableMorphoMetadata?: boolean;
  enableUsdEnrichment?: boolean;
  includeUnknownTokens?: boolean;
};

const hasSameSupplyingVaults = (current: Market['supplyingVaults'], next: Market['supplyingVaults']): boolean => {
  const currentVaults = current ?? [];
  const nextVaults = next ?? [];

  if (currentVaults.length !== nextVaults.length) {
    return false;
  }

  for (let index = 0; index < currentVaults.length; index += 1) {
    const currentAddress = currentVaults[index]?.address?.toLowerCase();
    const nextAddress = nextVaults[index]?.address?.toLowerCase();

    if (currentAddress !== nextAddress) {
      return false;
    }
  }

  return true;
};

/**
 * Processes raw markets data with blacklist filtering.
 *
 * It provides the foundation data that other hooks can build upon.
 *
 * Processing steps:
 * 1. Get raw markets from React Query
 * 2. Merge whitelist and supplying-vault metadata
 * 3. Apply blacklist and force-unwhitelisted overrides
 * 4. Backfill USD values when direct prices are available
 *
 * Identity-only consumers can disable USD enrichment so they do not pay for
 * token-price reads unrelated to their view.
 * Rolling rate enrichment is intentionally owned by downstream views that know
 * which visible rows or sort modes need that expensive work.
 *
 * @returns Processed markets with loading states
 *
 * @example
 * ```tsx
 * const { allMarkets, loading } = useProcessedMarkets();
 * const { whitelistedMarkets } = useProcessedMarkets();
 * const { rawMarketsUnfiltered } = useProcessedMarkets(); // For blacklist modal
 * ```
 */
export const useProcessedMarkets = (options?: UseProcessedMarketsOptions) => {
  const enabled = options?.enabled ?? true;
  const enableUsdEnrichment = options?.enableUsdEnrichment ?? true;
  const enableMorphoMetadata = options?.enableMorphoMetadata ?? true;
  const {
    data: rawMarketsFromQuery,
    isLoading,
    isRefetching,
    dataUpdatedAt,
    error,
    refetch,
  } = useMarketsQuery({
    enabled,
    refetchInterval: options?.marketsRefetchInterval,
    refetchOnWindowFocus: options?.marketsRefetchOnWindowFocus,
    includeUnknownTokens: options?.includeUnknownTokens,
  });
  const { whitelistLookup, supplyingVaultsLookup, availableWhitelistChainIds } = useMorphoWhitelistStatusQuery({
    enabled: enabled && enableMorphoMetadata,
  });
  const { getAllBlacklistedKeys, customBlacklistedMarkets } = useBlacklistedMarkets();
  const { getAllBlacklistedAssetKeys, customBlacklistedAssets } = useBlacklistedAssets();
  const { showUnwhitelistedMarkets } = useAppSettings();

  // Get blacklisted keys (memoized to prevent infinite loops)
  const allBlacklistedMarketKeys = useMemo(() => getAllBlacklistedKeys(), [customBlacklistedMarkets, getAllBlacklistedKeys]);
  const allBlacklistedAssetKeys = useMemo(() => getAllBlacklistedAssetKeys(), [customBlacklistedAssets, getAllBlacklistedAssetKeys]);

  // Process markets: blacklist filter + force-unwhitelisted overrides
  const processedData = useMemo(() => {
    if (!rawMarketsFromQuery) {
      return {
        rawMarketsUnfiltered: [],
        allMarkets: [],
      };
    }

    const withMergedMorphoMetadata = rawMarketsFromQuery.map((market) => {
      const marketIdentityKey = getMarketIdentityKey(market.morphoBlue.chain.id, market.uniqueKey);
      const cachedWhitelisted = whitelistLookup.get(marketIdentityKey);
      const cachedSupplyingVaults = supplyingVaultsLookup.get(marketIdentityKey);
      const nextWhitelisted = cachedWhitelisted ?? market.whitelisted;
      const nextSupplyingVaults = cachedSupplyingVaults ?? market.supplyingVaults;

      if (nextWhitelisted === market.whitelisted && hasSameSupplyingVaults(market.supplyingVaults, nextSupplyingVaults)) {
        return market;
      }

      return {
        ...market,
        whitelisted: nextWhitelisted,
        supplyingVaults: nextSupplyingVaults,
      };
    });

    // rawMarketsUnfiltered: before blacklist (for blacklist management modal)
    const rawMarketsUnfiltered = withMergedMorphoMetadata;

    // Apply market and asset blacklist filters
    const blacklistFiltered = rawMarketsUnfiltered.filter((market) => {
      if (allBlacklistedMarketKeys.has(market.uniqueKey)) return false;

      const chainId = market.morphoBlue.chain.id;
      return !(
        allBlacklistedAssetKeys.has(getAssetBlacklistKey(chainId, market.loanAsset.address)) ||
        allBlacklistedAssetKeys.has(getAssetBlacklistKey(chainId, market.collateralAsset.address))
      );
    });

    // Apply force-unwhitelisted overrides after blacklist filtering
    const enriched = blacklistFiltered.map((market) => {
      const shouldForceUnwhitelist = isForceUnwhitelisted(market.uniqueKey);

      return {
        ...market,
        ...(shouldForceUnwhitelist && { whitelisted: false }),
      };
    });

    // allMarkets: all markets (whitelisted + unwhitelisted, excluding blacklisted)
    const allMarkets = enriched;

    return {
      rawMarketsUnfiltered,
      allMarkets,
    };
  }, [rawMarketsFromQuery, allBlacklistedMarketKeys, allBlacklistedAssetKeys, whitelistLookup, supplyingVaultsLookup]);

  const { markets: allMarketsWithUsd, isLoading: isUsdEnrichmentLoading } = useUsdEnrichedMarkets(processedData.allMarkets, {
    enabled: enabled && enableUsdEnrichment,
  });

  const whitelistedMarketsWithUsd = useMemo(() => {
    return allMarketsWithUsd.filter((market) => isMarketVisibleWithWhitelistGuard(market, availableWhitelistChainIds));
  }, [allMarketsWithUsd, availableWhitelistChainIds]);

  // Computed markets based on showUnwhitelistedMarkets setting (for backward compatibility)
  const markets = useMemo(() => {
    return showUnwhitelistedMarkets ? allMarketsWithUsd : whitelistedMarketsWithUsd;
  }, [showUnwhitelistedMarkets, allMarketsWithUsd, whitelistedMarketsWithUsd]);

  return {
    rawMarketsFromQuery,
    ...processedData,
    allMarkets: allMarketsWithUsd,
    whitelistedMarkets: whitelistedMarketsWithUsd,
    markets, // Computed from setting (backward compatible with old context)
    dataUpdatedAt,
    isUsdEnrichmentLoading,
    loading: isLoading,
    isRefetching,
    error,
    refetch,
  };
};

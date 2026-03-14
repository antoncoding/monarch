import { useMemo } from 'react';
import { applyMarketMetadataMap } from '@/data-sources/shared/market-metadata';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useMarketsMetadataQuery } from '@/hooks/queries/useMarketsMetadataQuery';
import { useOracleDataQuery } from '@/hooks/queries/useOracleDataQuery';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useBlacklistedMarkets } from '@/stores/useBlacklistedMarkets';
import { useAppSettings } from '@/stores/useAppSettings';
import { collectTokenPriceInputsForMarkets, applyTokenPriceResolutionToMarkets } from '@/data-sources/shared/market-usd';
import { isForceUnwhitelisted } from '@/utils/markets';
import type { Market, MarketMetadata } from '@/utils/types';

const EMPTY_MARKET_METADATA_MAP = new Map<string, MarketMetadata>();

/**
 * Processes raw markets data with blacklist filtering and oracle enrichment.
 *
 * It provides the foundation data that other hooks can build upon.
 *
 * Processing steps:
 * 1. Get raw markets from React Query
 * 2. Remove blacklisted markets
 * 3. Enrich with oracle data
 * 4. Separate into allMarkets and whitelistedMarkets
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
export const useProcessedMarkets = () => {
  const { data: rawMarketsFromQuery, isLoading, isRefetching, error, refetch } = useMarketsQuery();
  const { data: marketMetadataMap, refetch: refetchMetadata } = useMarketsMetadataQuery();
  const { getAllBlacklistedKeys, customBlacklistedMarkets } = useBlacklistedMarkets();
  const { getOracleData } = useOracleDataQuery();
  const { showUnwhitelistedMarkets } = useAppSettings();

  // Get blacklisted keys (memoized to prevent infinite loops)
  const allBlacklistedMarketKeys = useMemo(() => getAllBlacklistedKeys(), [customBlacklistedMarkets, getAllBlacklistedKeys]);

  // Process markets: blacklist filter + oracle enrichment
  const processedData = useMemo(() => {
    if (!rawMarketsFromQuery) {
      return {
        rawMarketsUnfiltered: [],
        allMarkets: [],
        whitelistedMarkets: [],
      };
    }

    // rawMarketsUnfiltered: before blacklist (for blacklist management modal)
    const rawMarketsUnfiltered = rawMarketsFromQuery;

    // Apply blacklist filter
    const blacklistFiltered = rawMarketsUnfiltered.filter((market) => !allBlacklistedMarketKeys.has(market.uniqueKey));

    // Enrich with oracle data and apply force-unwhitelisted overrides
    const enriched = blacklistFiltered.map((market) => {
      const oracleData = getOracleData(market.oracleAddress, market.morphoBlue.chain.id);
      const shouldForceUnwhitelist = isForceUnwhitelisted(market.uniqueKey);

      return {
        ...market,
        ...(oracleData && { oracle: { data: oracleData } }),
        ...(shouldForceUnwhitelist && { whitelisted: false }),
      };
    });

    // allMarkets: all markets (whitelisted + unwhitelisted, excluding blacklisted)
    const allMarkets = enriched;

    // whitelistedMarkets: whitelisted only
    const whitelistedMarkets = enriched.filter((market) => market.whitelisted);

    return {
      rawMarketsUnfiltered,
      allMarkets,
      whitelistedMarkets,
    };
  }, [rawMarketsFromQuery, allBlacklistedMarketKeys, getOracleData]);

  // Build token list for USD fallbacks only when needed
  const tokensForUsdFallback = useMemo(() => collectTokenPriceInputsForMarkets(processedData.allMarkets), [processedData.allMarkets]);

  const { prices: tokenPrices, sources: tokenPriceSources } = useTokenPrices(tokensForUsdFallback);

  const allMarketsWithUsd = useMemo<Market[]>(() => {
    if (!processedData.allMarkets.length) return processedData.allMarkets;
    if (tokensForUsdFallback.length === 0 || tokenPrices.size === 0) return processedData.allMarkets;

    return applyTokenPriceResolutionToMarkets(processedData.allMarkets, tokenPrices, tokenPriceSources);
  }, [processedData.allMarkets, tokenPriceSources, tokenPrices, tokensForUsdFallback]);

  const whitelistedMarketsWithUsd = useMemo(() => {
    return allMarketsWithUsd.filter((market) => market.whitelisted);
  }, [allMarketsWithUsd]);

  const allMarketsWithMetadata = useMemo(() => {
    return applyMarketMetadataMap(allMarketsWithUsd, marketMetadataMap ?? EMPTY_MARKET_METADATA_MAP);
  }, [allMarketsWithUsd, marketMetadataMap]);

  const whitelistedMarketsWithMetadata = useMemo(() => {
    return allMarketsWithMetadata.filter((market) => market.whitelisted);
  }, [allMarketsWithMetadata]);

  // Computed markets based on showUnwhitelistedMarkets setting (for backward compatibility)
  const markets = useMemo(() => {
    return showUnwhitelistedMarkets ? allMarketsWithMetadata : whitelistedMarketsWithMetadata;
  }, [showUnwhitelistedMarkets, allMarketsWithMetadata, whitelistedMarketsWithMetadata]);

  return {
    ...processedData,
    allMarkets: allMarketsWithMetadata,
    whitelistedMarkets: whitelistedMarketsWithMetadata,
    markets, // Computed from setting (backward compatible with old context)
    loading: isLoading,
    isRefetching,
    error,
    refetch: async () => {
      await Promise.all([refetch(), refetchMetadata()]);
    },
  };
};

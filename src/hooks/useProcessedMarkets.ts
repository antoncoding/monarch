import { useMemo } from 'react';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useOracleDataQuery } from '@/hooks/queries/useOracleDataQuery';
import { useBlacklistedMarkets } from '@/stores/useBlacklistedMarkets';
import { useAppSettings } from '@/stores/useAppSettings';
import { isForceUnwhitelisted } from '@/utils/markets';

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

  // Computed markets based on showUnwhitelistedMarkets setting (for backward compatibility)
  const markets = useMemo(() => {
    return showUnwhitelistedMarkets ? processedData.allMarkets : processedData.whitelistedMarkets;
  }, [showUnwhitelistedMarkets, processedData.allMarkets, processedData.whitelistedMarkets]);

  return {
    ...processedData,
    markets, // Computed from setting (backward compatible with old context)
    loading: isLoading,
    isRefetching,
    error,
    refetch,
  };
};

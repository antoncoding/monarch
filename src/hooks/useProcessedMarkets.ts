import { useMemo } from 'react';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useOracleDataQuery } from '@/hooks/queries/useOracleDataQuery';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useBlacklistedMarkets } from '@/stores/useBlacklistedMarkets';
import { useAppSettings } from '@/stores/useAppSettings';
import { isForceUnwhitelisted } from '@/utils/markets';
import { getTokenPriceKey } from '@/data-sources/morpho-api/prices';
import { formatBalance } from '@/utils/balance';
import type { TokenPriceInput } from '@/data-sources/morpho-api/prices';
import type { Market } from '@/utils/types';

const hasPositiveAssets = (value?: string): boolean => {
  if (!value) return false;
  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
};

const isFiniteNumber = (value: number | null | undefined): value is number => {
  return value !== null && value !== undefined && Number.isFinite(value);
};

const shouldComputeUsd = (usdValue: number | null | undefined, assets?: string): boolean => {
  if (!isFiniteNumber(usdValue)) return hasPositiveAssets(assets);
  if (usdValue === 0 && hasPositiveAssets(assets)) return true;
  return false;
};

const computeUsdValue = (assets: string, decimals: number, price: number): number => {
  return formatBalance(assets, decimals) * price;
};

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

  // Build token list for USD fallbacks only when needed
  const tokensForUsdFallback = useMemo<TokenPriceInput[]>(() => {
    if (!processedData.allMarkets.length) return [];

    const tokens: TokenPriceInput[] = [];
    const seen = new Set<string>();

    const addToken = (address: string, chainId: number) => {
      const key = getTokenPriceKey(address, chainId);
      if (seen.has(key)) return;
      seen.add(key);
      tokens.push({ address, chainId });
    };

    processedData.allMarkets.forEach((market) => {
      const chainId = market.morphoBlue.chain.id;

      const needsLoanUsd =
        shouldComputeUsd(market.state?.supplyAssetsUsd, market.state?.supplyAssets) ||
        shouldComputeUsd(market.state?.borrowAssetsUsd, market.state?.borrowAssets) ||
        shouldComputeUsd(market.state?.liquidityAssetsUsd, market.state?.liquidityAssets);

      const needsCollateralUsd = shouldComputeUsd(market.state?.collateralAssetsUsd ?? null, market.state?.collateralAssets);

      if (needsLoanUsd) {
        addToken(market.loanAsset.address, chainId);
      }

      if (needsCollateralUsd) {
        addToken(market.collateralAsset.address, chainId);
      }
    });

    return tokens;
  }, [processedData.allMarkets]);

  const { prices: tokenPrices } = useTokenPrices(tokensForUsdFallback);

  const allMarketsWithUsd = useMemo<Market[]>(() => {
    if (!processedData.allMarkets.length) return processedData.allMarkets;
    if (tokensForUsdFallback.length === 0 || tokenPrices.size === 0) return processedData.allMarkets;

    return processedData.allMarkets.map((market) => {
      const chainId = market.morphoBlue.chain.id;
      const loanPrice = tokenPrices.get(getTokenPriceKey(market.loanAsset.address, chainId));
      const collateralPrice = tokenPrices.get(getTokenPriceKey(market.collateralAsset.address, chainId));

      let nextState = market.state;
      let changed = false;

      if (loanPrice !== undefined && Number.isFinite(loanPrice)) {
        if (shouldComputeUsd(nextState.supplyAssetsUsd, nextState.supplyAssets)) {
          nextState = { ...nextState, supplyAssetsUsd: computeUsdValue(nextState.supplyAssets, market.loanAsset.decimals, loanPrice) };
          changed = true;
        }
        if (shouldComputeUsd(nextState.borrowAssetsUsd, nextState.borrowAssets)) {
          nextState = { ...nextState, borrowAssetsUsd: computeUsdValue(nextState.borrowAssets, market.loanAsset.decimals, loanPrice) };
          changed = true;
        }
        if (shouldComputeUsd(nextState.liquidityAssetsUsd, nextState.liquidityAssets)) {
          nextState = {
            ...nextState,
            liquidityAssetsUsd: computeUsdValue(nextState.liquidityAssets, market.loanAsset.decimals, loanPrice),
          };
          changed = true;
        }
      }

      if (
        collateralPrice !== undefined &&
        Number.isFinite(collateralPrice) &&
        shouldComputeUsd(nextState.collateralAssetsUsd ?? null, nextState.collateralAssets)
      ) {
        nextState = {
          ...nextState,
          collateralAssetsUsd: computeUsdValue(nextState.collateralAssets, market.collateralAsset.decimals, collateralPrice),
        };
        changed = true;
      }

      return changed ? { ...market, state: nextState } : market;
    });
  }, [processedData.allMarkets, tokenPrices, tokensForUsdFallback]);

  const whitelistedMarketsWithUsd = useMemo(() => {
    return allMarketsWithUsd.filter((market) => market.whitelisted);
  }, [allMarketsWithUsd]);

  // Computed markets based on showUnwhitelistedMarkets setting (for backward compatibility)
  const markets = useMemo(() => {
    return showUnwhitelistedMarkets ? allMarketsWithUsd : whitelistedMarketsWithUsd;
  }, [showUnwhitelistedMarkets, allMarketsWithUsd, whitelistedMarketsWithUsd]);

  return {
    ...processedData,
    allMarkets: allMarketsWithUsd,
    whitelistedMarkets: whitelistedMarketsWithUsd,
    markets, // Computed from setting (backward compatible with old context)
    loading: isLoading,
    isRefetching,
    error,
    refetch,
  };
};

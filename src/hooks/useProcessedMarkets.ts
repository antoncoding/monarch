import { useMemo } from 'react';
import { getTokenPriceKey } from '@/data-sources/morpho-api/prices';
import { useMarketRateEnrichmentQuery } from '@/hooks/queries/useMarketRateEnrichmentQuery';
import { useMorphoWhitelistStatusQuery } from '@/hooks/queries/useMorphoWhitelistStatusQuery';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useBlacklistedMarkets } from '@/stores/useBlacklistedMarkets';
import { useAppSettings } from '@/stores/useAppSettings';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { getMarketRateEnrichmentKey, type MarketRateEnrichmentMap } from '@/utils/market-rate-enrichment';
import { isForceUnwhitelisted } from '@/utils/markets';
import { formatBalance } from '@/utils/balance';
import type { TokenPriceInput } from '@/data-sources/morpho-api/prices';
import type { Market } from '@/utils/types';

type UseProcessedMarketsOptions = {
  marketsRefetchInterval?: number | false;
  marketsRefetchOnWindowFocus?: boolean;
};

const EMPTY_RATE_ENRICHMENTS: MarketRateEnrichmentMap = new Map();

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

const shouldResolveUsdValue = (usdValue: number | null | undefined, assets: string | undefined, replaceEstimated: boolean): boolean => {
  if (replaceEstimated) return hasPositiveAssets(assets);
  return shouldComputeUsd(usdValue, assets);
};

const computeUsdValue = (assets: string, decimals: number, price: number): number => {
  return formatBalance(assets, decimals) * price;
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
 * 4. Enrich rolling 24h/7d/30d market rates via archive RPC + Morpho SDK math
 * 5. Backfill USD values when direct prices are available
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
  const {
    data: rawMarketsFromQuery,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useMarketsQuery({
    refetchInterval: options?.marketsRefetchInterval,
    refetchOnWindowFocus: options?.marketsRefetchOnWindowFocus,
  });
  const { whitelistLookup, supplyingVaultsLookup } = useMorphoWhitelistStatusQuery();
  const { getAllBlacklistedKeys, customBlacklistedMarkets } = useBlacklistedMarkets();
  const { showUnwhitelistedMarkets } = useAppSettings();

  // Get blacklisted keys (memoized to prevent infinite loops)
  const allBlacklistedMarketKeys = useMemo(() => getAllBlacklistedKeys(), [customBlacklistedMarkets, getAllBlacklistedKeys]);

  // Process markets: blacklist filter + force-unwhitelisted overrides
  const processedData = useMemo(() => {
    if (!rawMarketsFromQuery) {
      return {
        rawMarketsUnfiltered: [],
        allMarkets: [],
        whitelistedMarkets: [],
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

    // Apply blacklist filter
    const blacklistFiltered = rawMarketsUnfiltered.filter((market) => !allBlacklistedMarketKeys.has(market.uniqueKey));

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

    // whitelistedMarkets: whitelisted only
    const whitelistedMarkets = enriched.filter((market) => market.whitelisted);

    return {
      rawMarketsUnfiltered,
      allMarkets,
      whitelistedMarkets,
    };
  }, [rawMarketsFromQuery, allBlacklistedMarketKeys, whitelistLookup, supplyingVaultsLookup]);

  const {
    data: marketRateEnrichments = EMPTY_RATE_ENRICHMENTS,
    pendingChainIds: rateEnrichmentPendingChainIds,
    isLoading: isRateEnrichmentQueryLoading,
    isFetching: isRateEnrichmentFetching,
    isRefetching: isRateEnrichmentRefetching,
  } = useMarketRateEnrichmentQuery(processedData.allMarkets);

  const isRateEnrichmentLoading =
    processedData.allMarkets.length > 0 &&
    marketRateEnrichments.size === 0 &&
    rateEnrichmentPendingChainIds.size > 0 &&
    (isRateEnrichmentQueryLoading || isRateEnrichmentFetching);

  const allMarketsWithRates = useMemo<Market[]>(() => {
    if (!processedData.allMarkets.length || marketRateEnrichments.size === 0) {
      return processedData.allMarkets;
    }

    return processedData.allMarkets.map((market) => {
      const enrichment = marketRateEnrichments.get(getMarketRateEnrichmentKey(market.uniqueKey, market.morphoBlue.chain.id));
      if (!enrichment) {
        return market;
      }

      return {
        ...market,
        state: {
          ...market.state,
          ...enrichment,
        },
      };
    });
  }, [processedData.allMarkets, marketRateEnrichments]);

  // Build token list only for markets whose USD values need to be backfilled or upgraded from estimated prices.
  const tokensForUsdResolution = useMemo<TokenPriceInput[]>(() => {
    if (!allMarketsWithRates.length) return [];

    const tokens: TokenPriceInput[] = [];
    const seen = new Set<string>();

    const addToken = (address: string, chainId: number) => {
      const key = getTokenPriceKey(address, chainId);
      if (seen.has(key)) return;
      seen.add(key);
      tokens.push({ address, chainId });
    };

    allMarketsWithRates.forEach((market) => {
      const chainId = market.morphoBlue.chain.id;
      const hasLoanExposure =
        hasPositiveAssets(market.state?.supplyAssets) ||
        hasPositiveAssets(market.state?.borrowAssets) ||
        hasPositiveAssets(market.state?.liquidityAssets);

      const needsLoanUsd =
        (!market.hasUSDPrice && hasLoanExposure) ||
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
  }, [allMarketsWithRates]);

  const { prices: tokenPrices, directPriceKeys } = useTokenPrices(tokensForUsdResolution);

  const allMarketsWithUsd = useMemo<Market[]>(() => {
    if (!allMarketsWithRates.length) return allMarketsWithRates;
    if (tokensForUsdResolution.length === 0 || tokenPrices.size === 0) return allMarketsWithRates;

    return allMarketsWithRates.map((market) => {
      const chainId = market.morphoBlue.chain.id;
      const loanPriceKey = getTokenPriceKey(market.loanAsset.address, chainId);
      const collateralPriceKey = getTokenPriceKey(market.collateralAsset.address, chainId);
      const loanPrice = tokenPrices.get(loanPriceKey);
      const collateralPrice = tokenPrices.get(collateralPriceKey);
      const hasDirectLoanPrice = directPriceKeys.has(loanPriceKey);
      const shouldReplaceEstimatedLoanUsd = !market.hasUSDPrice && hasDirectLoanPrice;
      const shouldReplaceEstimatedCollateralUsd = !market.hasUSDPrice && directPriceKeys.has(collateralPriceKey);

      let nextState = market.state;
      let changed = false;

      if (loanPrice !== undefined && Number.isFinite(loanPrice)) {
        if (shouldResolveUsdValue(nextState.supplyAssetsUsd, nextState.supplyAssets, shouldReplaceEstimatedLoanUsd)) {
          nextState = { ...nextState, supplyAssetsUsd: computeUsdValue(nextState.supplyAssets, market.loanAsset.decimals, loanPrice) };
          changed = true;
        }
        if (shouldResolveUsdValue(nextState.borrowAssetsUsd, nextState.borrowAssets, shouldReplaceEstimatedLoanUsd)) {
          nextState = { ...nextState, borrowAssetsUsd: computeUsdValue(nextState.borrowAssets, market.loanAsset.decimals, loanPrice) };
          changed = true;
        }
        if (shouldResolveUsdValue(nextState.liquidityAssetsUsd, nextState.liquidityAssets, shouldReplaceEstimatedLoanUsd)) {
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
        shouldResolveUsdValue(nextState.collateralAssetsUsd ?? null, nextState.collateralAssets, shouldReplaceEstimatedCollateralUsd)
      ) {
        nextState = {
          ...nextState,
          collateralAssetsUsd: computeUsdValue(nextState.collateralAssets, market.collateralAsset.decimals, collateralPrice),
        };
        changed = true;
      }

      const nextHasUsdPrice = market.hasUSDPrice || hasDirectLoanPrice;

      if (!changed && nextHasUsdPrice === market.hasUSDPrice) {
        return market;
      }

      return {
        ...market,
        state: nextState,
        hasUSDPrice: nextHasUsdPrice,
      };
    });
  }, [allMarketsWithRates, directPriceKeys, tokenPrices, tokensForUsdResolution]);

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
    isRateEnrichmentLoading,
    rateEnrichmentPendingChainIds,
    loading: isLoading,
    isRefetching: isRefetching || isRateEnrichmentRefetching,
    error,
    refetch,
  };
};

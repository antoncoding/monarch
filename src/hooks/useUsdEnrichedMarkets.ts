import { useMemo } from 'react';
import { getTokenPriceKey, type TokenPriceInput } from '@/data-sources/morpho-api/prices';
import { formatBalance } from '@/utils/balance';
import type { Market } from '@/utils/types';
import { useTokenPrices } from './useTokenPrices';

type UseUsdEnrichedMarketsOptions = {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
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

export function collectMarketUsdTokenInputs(markets: Market[]): TokenPriceInput[] {
  if (!markets.length) return [];

  const tokens: TokenPriceInput[] = [];
  const seen = new Set<string>();

  const addToken = (address: string, chainId: number) => {
    const key = getTokenPriceKey(address, chainId);
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push({ address, chainId });
  };

  markets.forEach((market) => {
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
}

export function applyMarketUsdEnrichment({
  markets,
  tokenPrices,
  directPriceKeys,
  tokenInputs,
}: {
  markets: Market[];
  tokenPrices: Map<string, number>;
  directPriceKeys: Set<string>;
  tokenInputs: TokenPriceInput[];
}): Market[] {
  if (!markets.length) return markets;
  if (tokenInputs.length === 0 || tokenPrices.size === 0) return markets;

  return markets.map((market) => {
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
}

export function useUsdEnrichedMarkets(markets: Market[], options?: UseUsdEnrichedMarketsOptions) {
  const enabled = options?.enabled ?? true;
  const tokenInputs = useMemo(() => (enabled ? collectMarketUsdTokenInputs(markets) : []), [enabled, markets]);
  const {
    prices: tokenPrices,
    directPriceKeys,
    isLoading: isTokenPricesLoading,
  } = useTokenPrices(tokenInputs, {
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    refetchOnReconnect: options?.refetchOnReconnect,
  });
  const enrichedMarkets = useMemo(
    () =>
      enabled
        ? applyMarketUsdEnrichment({
            markets,
            tokenPrices,
            directPriceKeys,
            tokenInputs,
          })
        : markets,
    [directPriceKeys, enabled, markets, tokenInputs, tokenPrices],
  );

  return {
    markets: enrichedMarkets,
    tokenInputs,
    isLoading: enabled && tokenInputs.length > 0 && isTokenPricesLoading,
  };
}

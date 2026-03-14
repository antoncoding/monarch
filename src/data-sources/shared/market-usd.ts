import { getTokenPriceKey, type TokenPriceInput } from '@/data-sources/morpho-api/prices';
import { formatBalance } from '@/utils/balance';
import type { Market, MarketUsdPriceSource } from '@/utils/types';
import { fetchResolvedTokenPrices } from './token-prices';

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

const isFinitePositiveNumber = (value: number | undefined): value is number => {
  return value !== undefined && Number.isFinite(value) && value > 0;
};

export const shouldComputeUsd = (usdValue: number | null | undefined, assets?: string): boolean => {
  if (!isFiniteNumber(usdValue)) return hasPositiveAssets(assets);
  if (usdValue === 0 && hasPositiveAssets(assets)) return true;
  return false;
};

const computeUsdValue = (assets: string, decimals: number, price: number): number => {
  return formatBalance(assets, decimals) * price;
};

export const collectTokenPriceInputsForMarkets = (markets: Market[]): TokenPriceInput[] => {
  if (markets.length === 0) {
    return [];
  }

  const tokens: TokenPriceInput[] = [];
  const seen = new Set<string>();

  const addToken = (address: string, chainId: number) => {
    const key = getTokenPriceKey(address, chainId);
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push({ address, chainId });
  };

  for (const market of markets) {
    const chainId = market.morphoBlue.chain.id;
    const needsLoanUsd =
      shouldComputeUsd(market.state.supplyAssetsUsd, market.state.supplyAssets) ||
      shouldComputeUsd(market.state.borrowAssetsUsd, market.state.borrowAssets) ||
      shouldComputeUsd(market.state.liquidityAssetsUsd, market.state.liquidityAssets);
    const needsCollateralUsd = shouldComputeUsd(market.state.collateralAssetsUsd ?? null, market.state.collateralAssets);

    if (needsLoanUsd) {
      if (market.loanAsset?.address) {
        addToken(market.loanAsset.address, chainId);
      }
    }

    if (needsCollateralUsd) {
      if (market.collateralAsset?.address) {
        addToken(market.collateralAsset.address, chainId);
      }
    }
  }

  return tokens;
};

export const applyTokenPricesToMarkets = (markets: Market[], tokenPrices: Map<string, number>): Market[] => {
  const directPriceSources = new Map<string, MarketUsdPriceSource>();

  tokenPrices.forEach((_price, key) => {
    directPriceSources.set(key, 'direct');
  });

  return applyTokenPriceResolutionToMarkets(markets, tokenPrices, directPriceSources);
};

export const applyTokenPriceResolutionToMarkets = (
  markets: Market[],
  tokenPrices: Map<string, number>,
  tokenPriceSources: Map<string, MarketUsdPriceSource>,
): Market[] => {
  if (markets.length === 0 || tokenPrices.size === 0) {
    return markets;
  }

  return markets.map((market) => {
    const chainId = market.morphoBlue.chain.id;
    const loanPriceKey = market.loanAsset?.address ? getTokenPriceKey(market.loanAsset.address, chainId) : null;
    const collateralPriceKey = market.collateralAsset?.address ? getTokenPriceKey(market.collateralAsset.address, chainId) : null;
    const loanPrice = loanPriceKey ? tokenPrices.get(loanPriceKey) : undefined;
    const collateralPrice = collateralPriceKey ? tokenPrices.get(collateralPriceKey) : undefined;
    const loanPriceSource =
      (loanPriceKey ? tokenPriceSources.get(loanPriceKey) : undefined) ?? (isFinitePositiveNumber(loanPrice) ? 'direct' : undefined);

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

    const nextHasUsdPrice = market.hasUSDPrice || loanPriceSource === 'direct';
    const nextUsdPriceSource =
      market.usdPriceSource === 'direct' ? 'direct' : (loanPriceSource ?? market.usdPriceSource);

    if (!changed && market.hasUSDPrice === nextHasUsdPrice && market.usdPriceSource === nextUsdPriceSource) {
      return market;
    }

    return {
      ...market,
      hasUSDPrice: nextHasUsdPrice,
      usdPriceSource: nextUsdPriceSource,
      state: nextState,
    };
  });
};

export const fillMissingMarketUsdValues = async (markets: Market[]): Promise<Market[]> => {
  const tokenInputs = collectTokenPriceInputsForMarkets(markets);

  if (tokenInputs.length === 0) {
    return markets;
  }

  try {
    const { prices, sources } = await fetchResolvedTokenPrices(tokenInputs);
    return applyTokenPriceResolutionToMarkets(markets, prices, sources);
  } catch {
    return markets;
  }
};

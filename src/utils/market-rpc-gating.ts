import { formatUnits } from 'viem';
import { DEFAULT_MIN_LIQUIDITY_USD } from '@/constants/markets';
import { findToken, TokenPeg } from '@/utils/tokens';
import type { Market } from '@/utils/types';

type MarketRpcExposureInput = {
  loanAsset?: Pick<Market['loanAsset'], 'address' | 'decimals'>;
  collateralAsset?: Pick<Market['collateralAsset'], 'address' | 'decimals'>;
  morphoBlue?: {
    chain?: {
      id?: number;
    };
  };
  state?: Partial<
    Pick<
      Market['state'],
      | 'supplyAssets'
      | 'borrowAssets'
      | 'liquidityAssets'
      | 'collateralAssets'
      | 'supplyAssetsUsd'
      | 'borrowAssetsUsd'
      | 'liquidityAssetsUsd'
    >
  >;
};

const toFiniteUsd = (value: number | null | undefined): number => {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  return value;
};

export const getMarketRpcExposureUsd = (market: MarketRpcExposureInput): number =>
  Math.max(
    toFiniteUsd(market.state?.supplyAssetsUsd),
    toFiniteUsd(market.state?.borrowAssetsUsd),
    toFiniteUsd(market.state?.liquidityAssetsUsd),
  );

// RPC fallback is only for material markets where missing Morpho rate fields are
// worth an archive-node read. USD pegs use value; ETH/BTC/HYPE pegs use units so
// cross-asset markets such as BTC<>ETH must clear both relevant sides.
export const RATE_RPC_FALLBACK_MIN_USD_PEG_EXPOSURE_USD = DEFAULT_MIN_LIQUIDITY_USD;
export const RATE_RPC_FALLBACK_MIN_ETH = 5;
export const RATE_RPC_FALLBACK_MIN_BTC = 1;
export const RATE_RPC_FALLBACK_MIN_HYPE = 300;

const parseAssetUnits = (value: string | undefined, decimals: number | undefined): number => {
  if (!value || decimals == null) {
    return 0;
  }

  try {
    const units = Number(formatUnits(BigInt(value), decimals));
    return Number.isFinite(units) && units > 0 ? units : 0;
  } catch {
    return 0;
  }
};

const getRecognizedPeg = (asset: Pick<Market['loanAsset'], 'address'> | undefined, chainId: number | undefined): TokenPeg | null => {
  if (!asset?.address || chainId == null) {
    return null;
  }

  return findToken(asset.address, chainId)?.peg ?? null;
};

const getLoanAssetExposureUnits = (market: MarketRpcExposureInput): number =>
  Math.max(
    parseAssetUnits(market.state?.supplyAssets, market.loanAsset?.decimals),
    parseAssetUnits(market.state?.borrowAssets, market.loanAsset?.decimals),
    parseAssetUnits(market.state?.liquidityAssets, market.loanAsset?.decimals),
  );

const getCollateralAssetExposureUnits = (market: MarketRpcExposureInput): number =>
  parseAssetUnits(market.state?.collateralAssets, market.collateralAsset?.decimals);

const getPegThreshold = (peg: TokenPeg): number | null => {
  switch (peg) {
    case TokenPeg.USD:
      return RATE_RPC_FALLBACK_MIN_USD_PEG_EXPOSURE_USD;
    case TokenPeg.ETH:
      return RATE_RPC_FALLBACK_MIN_ETH;
    case TokenPeg.BTC:
      return RATE_RPC_FALLBACK_MIN_BTC;
    case TokenPeg.HYPE:
      return RATE_RPC_FALLBACK_MIN_HYPE;
    default:
      return null;
  }
};

const getPegExposureUnits = (market: MarketRpcExposureInput, peg: TokenPeg): number => {
  const chainId = market.morphoBlue?.chain?.id;
  const loanPeg = getRecognizedPeg(market.loanAsset, chainId);
  const collateralPeg = getRecognizedPeg(market.collateralAsset, chainId);
  const loanExposure = loanPeg === peg ? getLoanAssetExposureUnits(market) : 0;
  const collateralExposure = collateralPeg === peg ? getCollateralAssetExposureUnits(market) : 0;

  return Math.max(loanExposure, collateralExposure);
};

const hasPegExposure = (market: MarketRpcExposureInput, peg: TokenPeg): boolean => {
  const threshold = getPegThreshold(peg);
  if (threshold == null) {
    return false;
  }

  if (threshold <= 0) {
    return true;
  }

  if (peg === TokenPeg.USD) {
    return Math.max(getMarketRpcExposureUsd(market), getPegExposureUnits(market, peg)) >= threshold;
  }

  return getPegExposureUnits(market, peg) >= threshold;
};

export const shouldUseRateRpcFallbackForMarket = (market: MarketRpcExposureInput): boolean => {
  const chainId = market.morphoBlue?.chain?.id;
  const loanPeg = getRecognizedPeg(market.loanAsset, chainId);
  const collateralPeg = getRecognizedPeg(market.collateralAsset, chainId);

  if (!loanPeg) {
    return false;
  }

  if (
    ((loanPeg === TokenPeg.BTC && collateralPeg === TokenPeg.ETH) || (loanPeg === TokenPeg.ETH && collateralPeg === TokenPeg.BTC)) &&
    !(hasPegExposure(market, TokenPeg.BTC) && hasPegExposure(market, TokenPeg.ETH))
  ) {
    return false;
  }

  return hasPegExposure(market, loanPeg);
};

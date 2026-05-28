import { formatUnits } from 'viem';
import { getTokenPriceKey, type TokenPriceInput } from '@/data-sources/morpho-api/prices';
import type { MarketPositionWithEarnings } from './types';
import type { UserVaultV2 } from '@/data-sources/monarch-api/vaults';

const ONE_YEAR_IN_SECONDS = 86_400 * 365;

// Normalized balance type for all position sources
export type TokenBalance = {
  tokenAddress: string;
  chainId: number;
  balance: bigint;
  decimals: number;
};

// Portfolio breakdown by source
export type PortfolioBreakdown = {
  nativeSupplies: number;
  nativeBorrows: number;
  vaults: number;
};

// Portfolio value result
export type PortfolioValue = {
  total: number;
  breakdown: PortfolioBreakdown;
};

// Per-asset breakdown item for tooltip display
export type AssetBreakdownItem = {
  symbol: string;
  tokenAddress: string;
  chainId: number;
  balance: number;
  price: number;
  usdValue: number;
};

export type PortfolioAnalyticsRange = {
  startTimestamp: number;
  endTimestamp: number;
};

export type PortfolioAnalytics = {
  totalEarningsUsd: number;
  averageSupplyUsd: number;
  periodReturn: number | null;
  annualizedApr: number | null;
  annualizedApy: number | null;
  periodSeconds: number | null;
  pricedPositionCount: number;
  unpricedPositionCount: number;
  totalPositionCount: number;
};

export const EMPTY_PORTFOLIO_ANALYTICS: PortfolioAnalytics = {
  totalEarningsUsd: 0,
  averageSupplyUsd: 0,
  periodReturn: null,
  annualizedApr: null,
  annualizedApy: null,
  periodSeconds: null,
  pricedPositionCount: 0,
  unpricedPositionCount: 0,
  totalPositionCount: 0,
};

const toAmount = (value: string | number | bigint | null | undefined): bigint => {
  if (value === null || value === undefined || value === '') {
    return 0n;
  }

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const formatSignedUnits = (value: bigint, decimals: number): number => {
  const sign = value < 0n ? -1 : 1;
  const absoluteValue = value < 0n ? -value : value;
  const parsed = Number(formatUnits(absoluteValue, decimals));

  return Number.isFinite(parsed) ? parsed * sign : 0;
};

const hasSupplyAnalyticsHistory = (position: MarketPositionWithEarnings): boolean =>
  position.hasSupplyHistory ||
  toAmount(position.state.supplyAssets) > 0n ||
  toAmount(position.earned) !== 0n ||
  toAmount(position.totalDeposits) > 0n ||
  toAmount(position.totalWithdraws) > 0n ||
  toAmount(position.avgCapital) > 0n;

const getPositionWindowSeconds = (
  position: MarketPositionWithEarnings,
  earningsRangesByChain: Record<number, PortfolioAnalyticsRange> = {},
): number | null => {
  const chainId = position.market.morphoBlue.chain.id;
  const range = earningsRangesByChain[chainId];

  if (
    range &&
    Number.isFinite(range.startTimestamp) &&
    Number.isFinite(range.endTimestamp) &&
    range.endTimestamp > range.startTimestamp
  ) {
    return range.endTimestamp - range.startTimestamp;
  }

  const effectiveTime = Math.max(0, position.effectiveTime ?? 0);
  return effectiveTime > 0 ? effectiveTime : null;
};

/**
 * Extract unique tokens from native Morpho Blue positions
 * @param positions - Array of market positions with earnings
 * @returns Array of token price inputs for fetching
 */
export const extractTokensFromPositions = (positions: MarketPositionWithEarnings[]): TokenPriceInput[] => {
  const uniqueTokens = new Set<string>();
  const tokens: TokenPriceInput[] = [];

  positions.forEach((position) => {
    const tokenAddress = position.market.loanAsset.address;
    const chainId = position.market.morphoBlue.chain.id;
    const key = getTokenPriceKey(tokenAddress, chainId);

    if (!uniqueTokens.has(key)) {
      uniqueTokens.add(key);
      tokens.push({ address: tokenAddress, chainId });
    }
  });

  return tokens;
};

/**
 * Extract unique tokens from vault positions
 * @param vaults - Array of user vaults
 * @returns Array of token price inputs for fetching
 */
export const extractTokensFromVaults = (vaults: UserVaultV2[]): TokenPriceInput[] => {
  const uniqueTokens = new Set<string>();
  const tokens: TokenPriceInput[] = [];

  vaults.forEach((vault) => {
    const tokenAddress = vault.asset;
    const chainId = vault.networkId;
    const key = getTokenPriceKey(tokenAddress, chainId);

    if (!uniqueTokens.has(key)) {
      uniqueTokens.add(key);
      tokens.push({ address: tokenAddress, chainId });
    }
  });

  return tokens;
};

/**
 * Calculate total USD value from token balances and prices
 * @param balances - Array of token balances
 * @param prices - Map of token prices keyed by address-chainId
 * @returns Total USD value
 */
export const calculateUsdValue = (balances: TokenBalance[], prices: Map<string, number>): number => {
  let totalUsd = 0;

  balances.forEach((balance) => {
    const priceKey = getTokenPriceKey(balance.tokenAddress, balance.chainId);
    const price = prices.get(priceKey);

    if (price !== undefined && balance.balance > 0n) {
      // Convert balance to decimal using token decimals
      const balanceDecimal = Number.parseFloat(formatUnits(balance.balance, balance.decimals));
      // Calculate USD value
      const usdValue = balanceDecimal * price;
      totalUsd += usdValue;
    }
  });

  return totalUsd;
};

/**
 * Convert native positions to token balances
 * @param positions - Array of market positions
 * @returns Array of token balances
 */
export const positionsToBalances = (positions: MarketPositionWithEarnings[]): TokenBalance[] => {
  return positions.map((position) => ({
    tokenAddress: position.market.loanAsset.address,
    chainId: position.market.morphoBlue.chain.id,
    balance: BigInt(position.state.supplyAssets),
    decimals: position.market.loanAsset.decimals,
  }));
};

/**
 * Convert native borrow positions to token balances
 * @param positions - Array of market positions
 * @returns Array of token balances
 */
export const positionsToBorrowBalances = (positions: MarketPositionWithEarnings[]): TokenBalance[] => {
  return positions.map((position) => ({
    tokenAddress: position.market.loanAsset.address,
    chainId: position.market.morphoBlue.chain.id,
    balance: BigInt(position.state.borrowAssets),
    decimals: position.market.loanAsset.decimals,
  }));
};

/**
 * Convert vaults to token balances
 * @param vaults - Array of user vaults
 * @param findToken - Function to find token metadata
 * @returns Array of token balances
 */
export const vaultsToBalances = (
  vaults: UserVaultV2[],
  findToken: (address: string, chainId: number) => { decimals: number } | undefined,
): TokenBalance[] => {
  return vaults
    .filter((vault) => vault.balance !== undefined && vault.balance > 0n)
    .map((vault) => {
      // Get decimals from token metadata
      const token = findToken(vault.asset, vault.networkId);
      const decimals = token?.decimals ?? 18;

      return {
        tokenAddress: vault.asset,
        chainId: vault.networkId,
        balance: vault.balance ?? 0n,
        decimals,
      };
    });
};

/**
 * Calculate portfolio value from positions and vaults
 * @param positions - Array of market positions
 * @param vaults - Array of user vaults (optional)
 * @param prices - Map of token prices
 * @param findToken - Function to find token metadata (required for vaults)
 * @returns Portfolio value with breakdown
 */
export const calculatePortfolioValue = (
  positions: MarketPositionWithEarnings[],
  vaults: UserVaultV2[] | undefined,
  prices: Map<string, number>,
  findToken?: (address: string, chainId: number) => { decimals: number } | undefined,
): PortfolioValue => {
  // Convert positions to balances
  const positionBalances = positionsToBalances(positions);
  const nativeSuppliesUsd = calculateUsdValue(positionBalances, prices);
  const borrowBalances = positionsToBorrowBalances(positions);
  const nativeBorrowsUsd = calculateUsdValue(borrowBalances, prices);

  // Convert vaults to balances (if provided)
  let vaultsUsd = 0;
  if (vaults && vaults.length > 0 && findToken) {
    const vaultBalances = vaultsToBalances(vaults, findToken);
    vaultsUsd = calculateUsdValue(vaultBalances, prices);
  }

  return {
    total: nativeSuppliesUsd + vaultsUsd,
    breakdown: {
      nativeSupplies: nativeSuppliesUsd,
      nativeBorrows: nativeBorrowsUsd,
      vaults: vaultsUsd,
    },
  };
};

/**
 * Calculate per-asset breakdown for tooltip display
 * Aggregates holdings by token across positions and vaults
 */
export const calculateAssetBreakdown = (
  positions: MarketPositionWithEarnings[],
  vaults: UserVaultV2[] | undefined,
  prices: Map<string, number>,
  findToken?: (address: string, chainId: number) => { decimals: number; symbol?: string } | undefined,
): AssetBreakdownItem[] => {
  const aggregated = new Map<string, { symbol: string; tokenAddress: string; chainId: number; balance: bigint; decimals: number }>();

  // Aggregate positions by token
  for (const position of positions) {
    const { address, symbol, decimals } = position.market.loanAsset;
    const chainId = position.market.morphoBlue.chain.id;
    const key = getTokenPriceKey(address, chainId);
    const existing = aggregated.get(key);

    if (existing) {
      existing.balance += BigInt(position.state.supplyAssets);
    } else {
      aggregated.set(key, {
        symbol,
        tokenAddress: address,
        chainId,
        balance: BigInt(position.state.supplyAssets),
        decimals,
      });
    }
  }

  // Aggregate vaults by token
  if (vaults && findToken) {
    for (const vault of vaults) {
      if (!vault.balance || vault.balance <= 0n) continue;

      const key = getTokenPriceKey(vault.asset, vault.networkId);
      const existing = aggregated.get(key);
      const token = findToken(vault.asset, vault.networkId);
      const decimals = token?.decimals ?? 18;
      const symbol = token?.symbol ?? 'Unknown';

      if (existing) {
        existing.balance += vault.balance;
      } else {
        aggregated.set(key, {
          symbol,
          tokenAddress: vault.asset,
          chainId: vault.networkId,
          balance: vault.balance,
          decimals,
        });
      }
    }
  }

  // Convert to breakdown items with USD values
  const items: AssetBreakdownItem[] = [];
  for (const [key, data] of aggregated) {
    const price = prices.get(key) ?? 0;
    const balance = Number.parseFloat(formatUnits(data.balance, data.decimals));
    const usdValue = balance * price;

    items.push({
      symbol: data.symbol,
      tokenAddress: data.tokenAddress,
      chainId: data.chainId,
      balance,
      price,
      usdValue,
    });
  }

  // Sort by USD value descending
  return items.sort((a, b) => b.usdValue - a.usdValue);
};

/**
 * Calculate per-asset debt breakdown for tooltip display
 * Aggregates borrowed amounts by loan token across positions
 */
export const calculateDebtBreakdown = (positions: MarketPositionWithEarnings[], prices: Map<string, number>): AssetBreakdownItem[] => {
  const aggregated = new Map<string, { symbol: string; tokenAddress: string; chainId: number; balance: bigint; decimals: number }>();

  for (const position of positions) {
    const borrowAssets = BigInt(position.state.borrowAssets);
    if (borrowAssets <= 0n) continue;

    const { address, symbol, decimals } = position.market.loanAsset;
    const chainId = position.market.morphoBlue.chain.id;
    const key = getTokenPriceKey(address, chainId);
    const existing = aggregated.get(key);

    if (existing) {
      existing.balance += borrowAssets;
    } else {
      aggregated.set(key, {
        symbol,
        tokenAddress: address,
        chainId,
        balance: borrowAssets,
        decimals,
      });
    }
  }

  const items: AssetBreakdownItem[] = [];
  for (const [key, data] of aggregated) {
    const price = prices.get(key) ?? 0;
    const balance = Number.parseFloat(formatUnits(data.balance, data.decimals));
    const usdValue = balance * price;

    items.push({
      symbol: data.symbol,
      tokenAddress: data.tokenAddress,
      chainId: data.chainId,
      balance,
      price,
      usdValue,
    });
  }

  return items.sort((a, b) => b.usdValue - a.usdValue);
};

/**
 * Current-price portfolio yield: native-token earnings stay pure until this
 * aggregation step, then both earnings and time-weighted capital are converted
 * with current token prices so mixed-asset positions share one denominator.
 */
export const calculatePortfolioAnalytics = (
  positions: MarketPositionWithEarnings[],
  prices: Map<string, number>,
  earningsRangesByChain: Record<number, PortfolioAnalyticsRange> = {},
): PortfolioAnalytics => {
  let totalEarningsUsd = 0;
  let averageSupplyUsd = 0;
  let weightedWindowSeconds = 0;
  let pricedPositionCount = 0;
  let unpricedPositionCount = 0;
  let totalPositionCount = 0;

  for (const position of positions) {
    if (!hasSupplyAnalyticsHistory(position)) {
      continue;
    }

    totalPositionCount += 1;

    const chainId = position.market.morphoBlue.chain.id;
    const priceKey = getTokenPriceKey(position.market.loanAsset.address, chainId);
    const price = prices.get(priceKey);

    if (!price || !Number.isFinite(price) || price <= 0) {
      unpricedPositionCount += 1;
      continue;
    }

    pricedPositionCount += 1;

    const decimals = position.market.loanAsset.decimals;
    const earned = formatSignedUnits(toAmount(position.earned), decimals);
    const averageCapital = formatSignedUnits(toAmount(position.avgCapital), decimals);
    const effectiveTime = Math.max(0, position.effectiveTime ?? 0);
    const windowSeconds = getPositionWindowSeconds(position, earningsRangesByChain);
    const windowWeight = windowSeconds && effectiveTime > 0 ? Math.min(effectiveTime / windowSeconds, 1) : 1;
    const averageCapitalOverWindow = averageCapital * windowWeight;
    const earnedUsd = earned * price;
    const averageCapitalUsd = averageCapitalOverWindow * price;

    if (Number.isFinite(earnedUsd)) {
      totalEarningsUsd += earnedUsd;
    }

    if (Number.isFinite(averageCapitalUsd) && averageCapitalUsd > 0) {
      averageSupplyUsd += averageCapitalUsd;

      if (windowSeconds && Number.isFinite(windowSeconds) && windowSeconds > 0) {
        weightedWindowSeconds += averageCapitalUsd * windowSeconds;
      }
    }
  }

  if (averageSupplyUsd <= 0) {
    return {
      ...EMPTY_PORTFOLIO_ANALYTICS,
      totalEarningsUsd,
      pricedPositionCount,
      unpricedPositionCount,
      totalPositionCount,
    };
  }

  const periodReturn = totalEarningsUsd / averageSupplyUsd;
  const periodSeconds = weightedWindowSeconds > 0 ? weightedWindowSeconds / averageSupplyUsd : null;
  const annualization = periodSeconds && periodSeconds > 0 ? ONE_YEAR_IN_SECONDS / periodSeconds : null;
  const annualizedApr = annualization === null ? null : periodReturn * annualization;
  const annualizedApy = annualization === null ? null : periodReturn <= -1 ? -1 : (1 + periodReturn) ** annualization - 1;

  return {
    totalEarningsUsd,
    averageSupplyUsd,
    periodReturn,
    annualizedApr: annualizedApr !== null && Number.isFinite(annualizedApr) ? annualizedApr : null,
    annualizedApy: annualizedApy !== null && Number.isFinite(annualizedApy) ? annualizedApy : null,
    periodSeconds,
    pricedPositionCount,
    unpricedPositionCount,
    totalPositionCount,
  };
};

/**
 * Format USD value for display
 * @param value - USD value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted USD string
 */
export const formatUsdValue = (value: number, decimals = 2): string => {
  if (value === 0) return '$0.00';

  // Use compact notation for large values
  if (value >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

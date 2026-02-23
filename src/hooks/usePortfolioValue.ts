import { useMemo } from 'react';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import type { MarketPositionWithEarnings } from '@/utils/types';
import {
  type AssetBreakdownItem,
  calculateAssetBreakdown,
  calculateDebtBreakdown,
  calculatePortfolioValue,
  extractTokensFromPositions,
  extractTokensFromVaults,
} from '@/utils/portfolio';
import { useTokenPrices } from './useTokenPrices';

type UsePortfolioValueReturn = {
  totalUsd: number;
  totalDebtUsd: number;
  nativeSuppliesUsd: number;
  vaultsUsd: number;
  assetBreakdown: AssetBreakdownItem[];
  debtBreakdown: AssetBreakdownItem[];
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook to calculate total portfolio value from positions and vaults
 * @param positions - Array of market positions with earnings
 * @param vaults - Optional array of user vaults
 * @returns Portfolio value breakdown and loading/error states
 */
export const usePortfolioValue = (positions: MarketPositionWithEarnings[], vaults?: UserVaultV2[]): UsePortfolioValueReturn => {
  const { findToken } = useTokensQuery();

  // Extract unique tokens from all sources
  const tokens = useMemo(() => {
    const positionTokens = extractTokensFromPositions(positions);
    const vaultTokens = vaults ? extractTokensFromVaults(vaults) : [];
    return [...positionTokens, ...vaultTokens];
  }, [positions, vaults]);

  // Fetch prices for all tokens
  const { prices, isLoading, error } = useTokenPrices(tokens);

  // Calculate portfolio value and breakdown (memoized)
  const { portfolioValue, assetBreakdown, debtBreakdown } = useMemo(() => {
    if (isLoading || prices.size === 0) {
      return {
        portfolioValue: {
          total: 0,
          breakdown: { nativeSupplies: 0, nativeBorrows: 0, vaults: 0 },
        },
        assetBreakdown: [],
        debtBreakdown: [],
      };
    }

    return {
      portfolioValue: calculatePortfolioValue(positions, vaults, prices, findToken),
      assetBreakdown: calculateAssetBreakdown(positions, vaults, prices, findToken),
      debtBreakdown: calculateDebtBreakdown(positions, prices),
    };
  }, [positions, vaults, prices, isLoading, findToken]);

  return {
    totalUsd: portfolioValue.total,
    totalDebtUsd: portfolioValue.breakdown.nativeBorrows,
    nativeSuppliesUsd: portfolioValue.breakdown.nativeSupplies,
    vaultsUsd: portfolioValue.breakdown.vaults,
    assetBreakdown,
    debtBreakdown,
    isLoading,
    error,
  };
};

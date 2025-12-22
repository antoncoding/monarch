import { useMemo } from 'react';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import type { MarketPositionWithEarnings } from '@/utils/types';
import { calculatePortfolioValue, extractTokensFromPositions, extractTokensFromVaults } from '@/utils/portfolio';
import { useTokenPrices } from './useTokenPrices';

type UsePortfolioValueReturn = {
  totalUsd: number;
  nativeSuppliesUsd: number;
  vaultsUsd: number;
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
  // Extract unique tokens from all sources
  const tokens = useMemo(() => {
    const positionTokens = extractTokensFromPositions(positions);
    const vaultTokens = vaults ? extractTokensFromVaults(vaults) : [];
    return [...positionTokens, ...vaultTokens];
  }, [positions, vaults]);

  // Fetch prices for all tokens
  const { prices, isLoading, error } = useTokenPrices(tokens);

  // Calculate portfolio value (memoized)
  const portfolioValue = useMemo(() => {
    if (isLoading || prices.size === 0) {
      return {
        total: 0,
        breakdown: {
          nativeSupplies: 0,
          vaults: 0,
        },
      };
    }

    return calculatePortfolioValue(positions, vaults, prices);
  }, [positions, vaults, prices, isLoading]);

  return {
    totalUsd: portfolioValue.total,
    nativeSuppliesUsd: portfolioValue.breakdown.nativeSupplies,
    vaultsUsd: portfolioValue.breakdown.vaults,
    isLoading,
    error,
  };
};

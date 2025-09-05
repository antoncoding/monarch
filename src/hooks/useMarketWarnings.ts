import { useMemo } from 'react';
import { Market, WarningWithDetail } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

/**
 * Hook to compute market warnings with details on-demand
 * This separates data fetching concerns from presentation logic
 */
export const useMarketWarnings = (
  market: Pick<Market, 'warnings' | 'uniqueKey' | 'oracle' | 'oracleAddress' | 'morphoBlue'>,
  considerWhitelist = false,
): WarningWithDetail[] => {
  return useMemo(() => {
    return getMarketWarningsWithDetail(market, considerWhitelist);
  }, [market.warnings, market.uniqueKey, market.oracle, market.oracleAddress, market.morphoBlue?.chain?.id, considerWhitelist]);
};

/**
 * Utility function for computing warnings in non-React contexts
 * Use this in contexts where you can't use hooks
 */
export const computeMarketWarnings = (
  market: Pick<Market, 'warnings' | 'uniqueKey' | 'oracle' | 'oracleAddress' | 'morphoBlue'>,
  considerWhitelist = false,
): WarningWithDetail[] => {
  return getMarketWarningsWithDetail(market, considerWhitelist);
};
import { useMemo } from 'react';
import { useOracleMetadata, type OracleMetadataRecord } from '@/hooks/useOracleMetadata';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import type { Market, WarningWithDetail } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

/**
 * Hook to compute market warnings with details on-demand
 * Uses oracle metadata when available for accurate feed detection
 * Uses dynamic token list to filter out false "unrecognized asset" warnings
 */
export const useMarketWarnings = (market: Market | null | undefined): WarningWithDetail[] => {
  const chainId = market?.morphoBlue?.chain?.id;
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);
  const { findToken } = useTokensQuery();

  return useMemo(() => {
    if (!market) return [];

    const warnings = getMarketWarningsWithDetail(market, {
      considerWhitelist: true,
      oracleMetadataMap,
    });

    // Filter out false "unrecognized asset" warnings
    // The subgraph fetcher only checks static token list, but we have dynamic tokens too (Pendle, etc.)
    return warnings.filter((warning) => {
      if (warning.code === 'unrecognized_loan_asset' && market.loanAsset?.address) {
        const found = findToken(market.loanAsset.address, chainId ?? 0);
        if (found) return false; // Token found in dynamic list, remove warning
      }
      if (warning.code === 'unrecognized_collateral_asset' && market.collateralAsset?.address) {
        const found = findToken(market.collateralAsset.address, chainId ?? 0);
        if (found) return false; // Token found in dynamic list, remove warning
      }
      return true;
    });
  }, [market, oracleMetadataMap, findToken, chainId]);
};

/**
 * Utility function for computing warnings in non-React contexts
 * Use this in contexts where you can't use hooks
 * Note: Without oracle metadata, feed detection will be limited
 */
export const computeMarketWarnings = (
  market: Market,
  options?: { considerWhitelist?: boolean; oracleMetadataMap?: OracleMetadataRecord },
): WarningWithDetail[] => {
  return getMarketWarningsWithDetail(market, {
    considerWhitelist: options?.considerWhitelist ?? false,
    oracleMetadataMap: options?.oracleMetadataMap,
  });
};

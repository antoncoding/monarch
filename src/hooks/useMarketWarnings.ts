import { useMemo } from 'react';
import { useOracleMetadata, type OracleMetadataRecord } from '@/hooks/useOracleMetadata';
import type { Market, WarningWithDetail } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

/**
 * Hook to compute market warnings with details on-demand
 * Uses oracle metadata when available for accurate feed detection
 */
export const useMarketWarnings = (market: Market | null | undefined): WarningWithDetail[] => {
  const chainId = market?.morphoBlue?.chain?.id;
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);

  return useMemo(() => {
    if (!market) return [];
    return getMarketWarningsWithDetail(market, {
      considerWhitelist: true,
      oracleMetadataMap,
    });
  }, [market, oracleMetadataMap]);
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

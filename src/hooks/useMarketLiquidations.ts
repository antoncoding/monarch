import { useQuery } from '@tanstack/react-query';
import { fetchMarketLiquidations } from '@/data-sources/market-activity';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketLiquidationTransaction } from '@/utils/types'; // Use simplified type

/**
 * Hook to fetch all liquidations for a specific market, using the appropriate data source.
 * @param marketId The ID or unique key of the market.
 * @param network The blockchain network.
 * @returns List of liquidation transactions for the market.
 */
export const useMarketLiquidations = (marketId: string | undefined, network: SupportedNetworks | undefined) => {
  // Note: loanAssetId is not needed for liquidations query
  const queryKey = ['marketLiquidations', marketId, network];

  const { data, isLoading, error, refetch } = useQuery<MarketLiquidationTransaction[] | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketLiquidationTransaction[] | null> => {
      if (!marketId || !network) {
        return null;
      }

      return fetchMarketLiquidations(marketId, network);
    },
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5, // 5 minutes, liquidations are less frequent
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  // Return standard react-query hook structure
  return {
    data: data, // Consumers can alias this as 'liquidations' if desired
    isLoading: isLoading,
    error: error,
    refetch: refetch,
  };
};

export default useMarketLiquidations;

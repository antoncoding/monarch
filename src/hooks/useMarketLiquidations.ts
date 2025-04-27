import { useQuery } from '@tanstack/react-query';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoMarketLiquidations } from '@/data-sources/morpho-api/market-liquidations';
import { fetchSubgraphMarketLiquidations } from '@/data-sources/subgraph/market-liquidations';
import { SupportedNetworks } from '@/utils/networks';
import { MarketLiquidationTransaction } from '@/utils/types'; // Use simplified type

/**
 * Hook to fetch all liquidations for a specific market, using the appropriate data source.
 * @param marketId The ID or unique key of the market.
 * @param network The blockchain network.
 * @returns List of liquidation transactions for the market.
 */
export const useMarketLiquidations = (
  marketId: string | undefined,
  network: SupportedNetworks | undefined,
) => {
  // Note: loanAssetId is not needed for liquidations query
  const queryKey = ['marketLiquidations', marketId, network];

  // Determine the data source
  const dataSource = network ? getMarketDataSource(network) : null;

  const { data, isLoading, error, refetch } = useQuery<MarketLiquidationTransaction[] | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketLiquidationTransaction[] | null> => {
      // Guard clauses
      if (!marketId || !network || !dataSource) {
        return null;
      }

      console.log(
        `Fetching market liquidations for market ${marketId} on ${network} via ${dataSource}`,
      );

      try {
        if (dataSource === 'morpho') {
          return await fetchMorphoMarketLiquidations(marketId);
        } else if (dataSource === 'subgraph') {
          console.log('fetching subgraph liquidations');
          return await fetchSubgraphMarketLiquidations(marketId, network);
        }
      } catch (fetchError) {
        console.error(`Failed to fetch market liquidations via ${dataSource}:`, fetchError);
        return null;
      }

      console.warn('Unknown market data source determined for liquidations');
      return null;
    },
    enabled: !!marketId && !!network && !!dataSource,
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
    dataSource: dataSource,
  };
};

export default useMarketLiquidations;

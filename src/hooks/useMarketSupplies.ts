import { useQuery } from '@tanstack/react-query';
import { getMarketDataSource } from '@/config/dataSources';
import { SupportedNetworks } from '@/utils/networks';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { fetchSubgraphMarketSupplies } from '@/data-sources/subgraph/market-supplies';
import { MarketActivityTransaction } from '@/utils/types';

/**
 * Hook to fetch all supply and withdraw activities for a specific market's loan asset,
 * using the appropriate data source based on the network.
 * @param marketId The ID of the market (e.g., 0x...).
 * @param loanAssetId The address of the loan asset for the market.
 * @param network The blockchain network.
 * @returns List of supply and withdraw transactions for the market's loan asset.
 */
export const useMarketSupplies = (
  marketId: string | undefined,
  loanAssetId: string | undefined,
  network: SupportedNetworks | undefined,
) => {
  const queryKey = ['marketSupplies', marketId, loanAssetId, network];

  // Determine the data source
  const dataSource = network ? getMarketDataSource(network) : null;

  console.log('dataSource', dataSource)

  const { data, isLoading, error, refetch } = useQuery<
    MarketActivityTransaction[] | null // The hook returns the unified type
  >({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketActivityTransaction[] | null> => {
      // Guard clauses
      if (!marketId || !loanAssetId || !network || !dataSource) {
        return null;
      }

      console.log(
        `Fetching market supplies for market ${marketId} (loan asset ${loanAssetId}) on ${network} via ${dataSource}`,
      );

      try {
        // Call the appropriate imported function
        if (dataSource === 'morpho') {
          return await fetchMorphoMarketSupplies(marketId);
        } else if (dataSource === 'subgraph') {
          return await fetchSubgraphMarketSupplies(marketId, loanAssetId, network);
        }
      } catch (fetchError) {
        // Log the specific error from the data source function
        console.error(
          `Failed to fetch market supplies via ${dataSource} for market ${marketId}:`,
          fetchError,
        );
        return null; // Return null on fetch error
      }

      // This case should ideally not be reached if getMarketDataSource is exhaustive
      console.warn('Unknown market data source determined for supplies');
      return null;
    },
    // enable query only if all parameters are present AND a valid data source exists
    enabled: !!marketId && !!loanAssetId && !!network && !!dataSource,
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  return {
    data: data,
    isLoading: isLoading,
    error: error,
    refetch: refetch,
    dataSource: dataSource,
  };
};

// Keep export default for potential existing imports, but prefer named export
export default useMarketSupplies;

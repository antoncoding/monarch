import { useQuery } from '@tanstack/react-query';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoMarketBorrows } from '@/data-sources/morpho-api/market-borrows';
import { fetchSubgraphMarketBorrows } from '@/data-sources/subgraph/market-borrows';
import { SupportedNetworks } from '@/utils/networks';
import { MarketActivityTransaction } from '@/utils/types';

/**
 * Hook to fetch all borrow and repay activities for a specific market's loan asset,
 * using the appropriate data source based on the network.
 * @param marketId The ID or unique key of the market.
 * @param loanAssetId The address of the loan asset for the market.
 * @param network The blockchain network.
 * @returns List of borrow and repay transactions for the market's loan asset.
 */
export const useMarketBorrows = (
  marketId: string | undefined,
  loanAssetId: string | undefined,
  network: SupportedNetworks | undefined,
) => {
  const queryKey = ['marketBorrows', marketId, loanAssetId, network];

  // Determine the data source
  const dataSource = network ? getMarketDataSource(network) : null;

  const { data, isLoading, error, refetch } = useQuery<MarketActivityTransaction[] | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketActivityTransaction[] | null> => {
      // Guard clauses
      if (!marketId || !loanAssetId || !network || !dataSource) {
        return null;
      }

      console.log(
        `Fetching market borrows for market ${marketId} (loan asset ${loanAssetId}) on ${network} via ${dataSource}`,
      );

      try {
        if (dataSource === 'morpho') {
          // Morpho API might only need marketId for borrows
          return await fetchMorphoMarketBorrows(marketId);
        } else if (dataSource === 'subgraph') {
          return await fetchSubgraphMarketBorrows(marketId, loanAssetId, network);
        }
      } catch (fetchError) {
        console.error(`Failed to fetch market borrows via ${dataSource}:`, fetchError);
        return null;
      }

      console.warn('Unknown market data source determined for borrows');
      return null;
    },
    enabled: !!marketId && !!loanAssetId && !!network && !!dataSource,
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  // Return react-query result structure
  return {
    data: data,
    isLoading: isLoading,
    error: error,
    refetch: refetch,
    dataSource: dataSource,
  };
};

export default useMarketBorrows;

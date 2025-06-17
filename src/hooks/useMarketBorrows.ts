import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
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

  const { data, isLoading, error, refetch } = useQuery<MarketActivityTransaction[] | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketActivityTransaction[] | null> => {
      if (!marketId || !loanAssetId || !network) {
        return null;
      }

      let borrows: MarketActivityTransaction[] | null = null;

      // Try Morpho API first if supported
      if (supportsMorphoApi(network)) {
        try {
          console.log(`Attempting to fetch borrows via Morpho API for ${marketId}`);
          borrows = await fetchMorphoMarketBorrows(marketId);
        } catch (morphoError) {
          console.error(`Failed to fetch borrows via Morpho API:`, morphoError);
          // Continue to Subgraph fallback
        }
      }

      // If Morpho API failed or not supported, try Subgraph
      if (!borrows) {
        try {
          console.log(`Attempting to fetch borrows via Subgraph for ${marketId}`);
          borrows = await fetchSubgraphMarketBorrows(marketId, loanAssetId, network);
        } catch (subgraphError) {
          console.error(`Failed to fetch borrows via Subgraph:`, subgraphError);
          borrows = null;
        }
      }

      return borrows;
    },
    enabled: !!marketId && !!loanAssetId && !!network,
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
  };
};

export default useMarketBorrows;

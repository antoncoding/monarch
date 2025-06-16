import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { fetchSubgraphMarketSupplies } from '@/data-sources/subgraph/market-supplies';
import { SupportedNetworks } from '@/utils/networks';
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

  const { data, isLoading, error, refetch } = useQuery<MarketActivityTransaction[] | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<MarketActivityTransaction[] | null> => {
      if (!marketId || !loanAssetId || !network) {
        return null;
      }

      let supplies: MarketActivityTransaction[] | null = null;

      // Try Morpho API first if supported
      if (supportsMorphoApi(network)) {
        try {
          console.log(`Attempting to fetch supplies via Morpho API for ${marketId}`);
          supplies = await fetchMorphoMarketSupplies(marketId);
        } catch (morphoError) {
          console.error(`Failed to fetch supplies via Morpho API:`, morphoError);
          // Continue to Subgraph fallback
        }
      }

      // If Morpho API failed or not supported, try Subgraph
      if (!supplies) {
        try {
          console.log(`Attempting to fetch supplies via Subgraph for ${marketId}`);
          supplies = await fetchSubgraphMarketSupplies(marketId, loanAssetId, network);
        } catch (subgraphError) {
          console.error(`Failed to fetch supplies via Subgraph:`, subgraphError);
          supplies = null;
        }
      }

      return supplies;
    },
    enabled: !!marketId && !!loanAssetId && !!network,
    staleTime: 1000 * 60 * 2,
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  return {
    data: data,
    isLoading: isLoading,
    error: error,
    refetch: refetch,
  };
};

// Keep export default for potential existing imports, but prefer named export
export default useMarketSupplies;

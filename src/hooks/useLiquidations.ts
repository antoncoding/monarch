import { useState, useEffect, useCallback } from 'react';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoApiLiquidatedMarketKeys } from '@/data-sources/morpho-api/liquidations';
import { fetchSubgraphLiquidatedMarketKeys } from '@/data-sources/subgraph/liquidations';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';

const useLiquidations = () => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [liquidatedMarketKeys, setLiquidatedMarketKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<unknown | null>(null);

  const fetchLiquidations = useCallback(async (isRefetch = false) => {
    if (isRefetch) {
      setIsRefetching(true);
    } else {
      setLoading(true);
    }
    setError(null); // Reset error

    // Define the networks to check for liquidations
    
    const combinedLiquidatedKeys = new Set<string>();
    let fetchErrors: unknown[] = [];

    try {
      await Promise.all(
        ALL_SUPPORTED_NETWORKS.map(async (network) => {
          try {
            let networkLiquidatedKeys: Set<string>;
            let trySubgraph = false

            // Try Morpho API first if supported
            if (supportsMorphoApi(network)) {
              try {
                console.log(`Attempting to fetch liquidated markets via Morpho API for ${network}`);
                networkLiquidatedKeys = await fetchMorphoApiLiquidatedMarketKeys(network);
              } catch (morphoError) {
                console.error(`Failed to fetch liquidated markets via Morpho API:`, morphoError);
                // Continue to Subgraph fallback
                networkLiquidatedKeys = new Set();
                trySubgraph = true
              }
            } else {
              networkLiquidatedKeys = new Set();
              trySubgraph = true
            }

            // If Morpho API failed or not supported, try Subgraph
            if (trySubgraph) {
              try {
                console.log(`Attempting to fetch liquidated markets via Subgraph for ${network}`);
                networkLiquidatedKeys = await fetchSubgraphLiquidatedMarketKeys(network);
              } catch (subgraphError) {
                console.error(`Failed to fetch liquidated markets via Subgraph:`, subgraphError);
                throw subgraphError; // Throw to be caught by outer catch
              }
            }

            // Add the keys to the combined set
            networkLiquidatedKeys.forEach((key) => combinedLiquidatedKeys.add(key));
          } catch (networkError) {
            console.error(
              `Failed to fetch liquidated markets for network ${network}:`,
              networkError,
            );
            fetchErrors.push(networkError);
          }
        }),
      );

      setLiquidatedMarketKeys(combinedLiquidatedKeys);

      if (fetchErrors.length > 0) {
        setError(fetchErrors[0]);
      }
    } catch (err) {
      console.error('Error fetching liquidated markets:', err);
      setError(err);
    } finally {
      if (isRefetch) {
        setIsRefetching(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLiquidations().catch((err) => {
      console.error('Error in fetchLiquidations effect:', err);
      // Explicitly catch and handle - prevents React error boundary from triggering
    });
  }, [fetchLiquidations]);

  return {
    loading,
    isRefetching,
    liquidatedMarketKeys,
    error,
    refetch: async () => fetchLiquidations(true),
  };
};

export default useLiquidations;

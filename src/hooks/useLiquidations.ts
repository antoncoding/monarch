import { useState, useEffect, useCallback } from 'react';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoApiLiquidatedMarketKeys } from '@/data-sources/morpho-api/liquidations';
import { fetchSubgraphLiquidatedMarketKeys } from '@/data-sources/subgraph/liquidations';
import { SupportedNetworks } from '@/utils/networks';

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
    const networksToCheck: SupportedNetworks[] = [
      SupportedNetworks.Mainnet,
      SupportedNetworks.Base,
    ];

    const combinedLiquidatedKeys = new Set<string>();
    let fetchErrors: unknown[] = [];

    try {
      await Promise.all(
        networksToCheck.map(async (network) => {
          try {
            const dataSource = getMarketDataSource(network);
            let networkLiquidatedKeys: Set<string>;

            console.log(`Fetching liquidated markets for ${network} via ${dataSource}`);

            if (dataSource === 'morpho') {
              networkLiquidatedKeys = await fetchMorphoApiLiquidatedMarketKeys(network);
            } else if (dataSource === 'subgraph') {
              networkLiquidatedKeys = await fetchSubgraphLiquidatedMarketKeys(network);
            } else {
              console.warn(`No valid data source found for network ${network} for liquidations.`);
              networkLiquidatedKeys = new Set<string>(); // Assume none if no source
            }

            // Add keys from this network to the combined set
            networkLiquidatedKeys.forEach((key) => combinedLiquidatedKeys.add(key));
          } catch (networkError) {
            console.error(
              `Failed to fetch liquidated market keys for network ${network}:`,
              networkError,
            );
            fetchErrors.push(networkError); // Collect errors
          }
        }),
      );

      setLiquidatedMarketKeys(combinedLiquidatedKeys);

      // Set overall error if any network fetch failed
      if (fetchErrors.length > 0) {
        setError(fetchErrors[0]); // Or aggregate errors if needed
      }
    } catch (err) {
      // Catch potential errors from Promise.all itself
      console.error('Overall error fetching liquidations:', err);
      setError(err);
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, []); // Dependencies: None needed directly, fetchers are self-contained

  useEffect(() => {
    fetchLiquidations().catch(console.error);
  }, [fetchLiquidations]);

  const refetch = useCallback(() => {
    fetchLiquidations(true).catch(console.error);
  }, [fetchLiquidations]);

  return { loading, isRefetching, liquidatedMarketKeys, error, refetch };
};

export default useLiquidations;

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address, zeroAddress } from 'viem';
import { fetchMorphoMarketV1Adapters, MorphoMarketV1AdapterRecord } from '@/data-sources/subgraph/morpho-market-v1-adapters';
import { getMorphoAddress } from '@/utils/morpho';
import { getNetworkConfig, SupportedNetworks } from '@/utils/networks';

export function useMorphoMarketV1Adapters({
  vaultAddress,
  chainId,
}: {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
}) {
  const [adapters, setAdapters] = useState<MorphoMarketV1AdapterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vaultConfig = useMemo(() => {
    try {
      return getNetworkConfig(chainId).vaultConfig;
    } catch (err) {
      return undefined;
    }
  }, [chainId]);

  const subgraphUrl = vaultConfig?.adapterSubgraphEndpoint ?? null;
  const morpho = useMemo(() => getMorphoAddress(chainId), [chainId]);

  const fetchAdapters = useCallback(async () => {
    if (!vaultAddress || !subgraphUrl) {
      setAdapters([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchMorphoMarketV1Adapters({
        subgraphUrl,
        parentVault: vaultAddress,
        morpho,
      });
      setAdapters(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch adapters'));
      setAdapters([]);
    } finally {
      setLoading(false);
    }
  }, [vaultAddress, subgraphUrl, morpho]);

  useEffect(() => {
    void fetchAdapters();
  }, [fetchAdapters]);

  const morphoMarketV1Adapter = useMemo(() => adapters.length == 0? zeroAddress : adapters[0].adapter, [adapters])

  return {
    morphoMarketV1Adapter,
    adapters, // all market adapters (should only be just one)
    loading,
    error,
    refetch: fetchAdapters,
    hasAdapters: adapters.length > 0,
  };
}

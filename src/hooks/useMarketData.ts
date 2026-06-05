import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchMarket } from '@/data-sources/monarch-api';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { useApiResponseCache } from '@/stores/useApiResponseCache';
import { getMarketDetailCacheKey } from '@/utils/marketDetailCacheKey';
import type { SupportedNetworks } from '@/utils/networks';
import { fetchMarketSnapshot, type MarketSnapshot } from '@/utils/positions';
import type { Market } from '@/utils/types';

const mergeMonarchStateIntoMarket = (marketShell: Market, monarchMarket: Market): Market => ({
  ...marketShell,
  state: {
    ...marketShell.state,
    borrowAssets: monarchMarket.state.borrowAssets,
    supplyAssets: monarchMarket.state.supplyAssets,
    borrowShares: monarchMarket.state.borrowShares,
    supplyShares: monarchMarket.state.supplyShares,
    liquidityAssets: monarchMarket.state.liquidityAssets,
    collateralAssets: monarchMarket.state.collateralAssets,
    utilization: monarchMarket.state.utilization,
    supplyApy: monarchMarket.state.supplyApy,
    borrowApy: monarchMarket.state.borrowApy,
    fee: monarchMarket.state.fee,
    timestamp: monarchMarket.state.timestamp,
    apyAtTarget: monarchMarket.state.apyAtTarget,
    rateAtTarget: monarchMarket.state.rateAtTarget,
  },
});

const mergeSnapshotIntoMarket = (market: Market, snapshot: MarketSnapshot): Market => ({
  ...market,
  state: {
    ...market.state,
    supplyAssets: snapshot.totalSupplyAssets,
    supplyShares: snapshot.totalSupplyShares,
    borrowAssets: snapshot.totalBorrowAssets,
    borrowShares: snapshot.totalBorrowShares,
    liquidityAssets: snapshot.liquidityAssets,
  },
});

const fetchRpcMarketSnapshot = async (
  uniqueKey: string,
  network: SupportedNetworks,
  publicClient: PublicClient,
): Promise<MarketSnapshot | null> => {
  console.log(`Attempting fetchMarketSnapshot for market ${uniqueKey}`);

  try {
    const snapshot = await fetchMarketSnapshot(uniqueKey, network, publicClient);
    console.log(`Market state (from RPC) result for ${uniqueKey}:`, snapshot ? 'Exists' : 'Null');
    return snapshot;
  } catch (snapshotError) {
    console.error(`Error fetching market snapshot for ${uniqueKey}:`, snapshotError);
    return null;
  }
};

const fetchFallbackMarketShell = async (uniqueKey: string, network: SupportedNetworks): Promise<Market | null> => {
  if (supportsMorphoApi(network)) {
    try {
      console.log(`Attempting to fetch market shell via Morpho API for ${uniqueKey}`);
      const morphoMarket = await fetchMorphoMarket(uniqueKey, network);
      if (morphoMarket) {
        return morphoMarket;
      }
    } catch (morphoError) {
      console.error('Failed to fetch market shell via Morpho API:', morphoError);
    }
  }

  return null;
};

const fetchMonarchMarketState = async (uniqueKey: string, network: SupportedNetworks): Promise<Market | null> => {
  try {
    console.log(`Attempting to fetch market state via Monarch API for ${uniqueKey}`);
    return await fetchMonarchMarket(uniqueKey, network);
  } catch (monarchError) {
    console.error('Failed to fetch market state via Monarch API:', monarchError);
    return null;
  }
};

export const useMarketData = (uniqueKey: string | undefined, network: SupportedNetworks | undefined) => {
  const queryKey = ['marketData', uniqueKey, network];
  const cacheKey = uniqueKey && network ? getMarketDetailCacheKey(network, uniqueKey) : null;
  const cachedMarket = useApiResponseCache((state) => (cacheKey ? state.marketDetailsByKey[cacheKey] : undefined));
  const setCachedMarket = useApiResponseCache((state) => state.setMarketDetail);
  const publicClient = usePublicClient({ chainId: network });

  const { data, dataUpdatedAt, error, isFetchedAfterMount, isLoading, isSuccess, refetch } = useQuery<Market | null>({
    queryKey: queryKey,
    queryFn: async (): Promise<Market | null> => {
      console.log('fetching market');

      if (!uniqueKey || !network) {
        return null;
      }

      if (!publicClient) {
        console.error('Public client not available');
        return null;
      }

      const [snapshot, monarchMarket, fallbackMarketShell] = await Promise.all([
        fetchRpcMarketSnapshot(uniqueKey, network, publicClient),
        fetchMonarchMarketState(uniqueKey, network),
        fetchFallbackMarketShell(uniqueKey, network),
      ]);

      let finalMarket = fallbackMarketShell;

      // Preserve shell-only metadata such as whitelist and supplying vaults until Monarch exposes parity.
      if (fallbackMarketShell && monarchMarket) {
        finalMarket = mergeMonarchStateIntoMarket(fallbackMarketShell, monarchMarket);
      } else if (monarchMarket) {
        finalMarket = monarchMarket;
      }

      if (snapshot && finalMarket) {
        console.log(`Found market snapshot for ${uniqueKey}, overriding live balances with on-chain data.`);
        finalMarket = mergeSnapshotIntoMarket(finalMarket, snapshot);
      } else if (!finalMarket) {
        console.error(`Failed to fetch market data for ${uniqueKey} via Monarch or Morpho API.`);
      } else if (!snapshot) {
        console.warn(`Market snapshot failed for ${uniqueKey}, using indexed market state only.`);
      }

      console.log(`Final market data for ${uniqueKey}:`, finalMarket ? 'Found' : 'Not Found');

      return finalMarket;
    },
    enabled: !!uniqueKey && !!network,
    initialData: cacheKey ? cachedMarket?.data : undefined,
    initialDataUpdatedAt: cacheKey ? cachedMarket?.updatedAt : undefined,
    refetchOnMount: true,
    staleTime: 30_000, // 30 seconds - individual market view needs accuracy
    refetchInterval: 30_000, // Match staleTime for consistency
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  useEffect(() => {
    if (!cacheKey || !data || !isSuccess || !isFetchedAfterMount) {
      return;
    }

    if (dataUpdatedAt <= (cachedMarket?.updatedAt ?? 0)) {
      return;
    }

    setCachedMarket(cacheKey, data);
  }, [cacheKey, cachedMarket?.updatedAt, data, dataUpdatedAt, isFetchedAfterMount, isSuccess, setCachedMarket]);

  return {
    data,
    isLoading: isLoading && !cachedMarket,
    error: data ? null : error,
    refetch: refetch,
  };
};

import { useQuery } from '@tanstack/react-query';
import { getRewardPer1000USD } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { MORPHOTokenAddress } from '@/utils/tokens';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { marketDetailQuery, marketHistoricalDataQuery } from '../graphql/queries';
import { MarketDetail, TimeseriesOptions, Market } from '../utils/types';
import { URLS } from '@/utils/urls';

type GraphQLResponse = {
  data: {
    marketByUniqueKey: MarketDetail;
  };
  errors?: { message: string }[];
};

const graphqlFetcher = async (
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphQLResponse> => {
  const response = await fetch(URLS.MORPHO_BLUE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const result = (await response.json()) as GraphQLResponse;

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return result;
};

const processMarketData = (market: Market): MarketDetail => {
  const entry = market.state.rewards.find(
    (reward) => reward.asset.address.toLowerCase() === MORPHOTokenAddress?.toLowerCase(),
  );

  const warningsWithDetail = getMarketWarningsWithDetail(market);

  let rewardPer1000USD: string | undefined;
  if (entry) {
    const supplyAssetUSD = Number(market.state.supplyAssetsUsd);
    rewardPer1000USD = getRewardPer1000USD(entry.yearlySupplyTokens, supplyAssetUSD);
  }

  return {
    ...market,
    rewardPer1000USD,
    warningsWithDetail,
    isProtectedByLiquidationBots: false, // NOT needed for now, might implement later
    historicalState: {
      supplyApy: [],
      borrowApy: [],
      supplyAssetsUsd: [],
      borrowAssetsUsd: [],
      rateAtUTarget: [],
      utilization: [],
      supplyAssets: [],
      borrowAssets: [],
      liquidityAssetsUsd: [],
      liquidityAssets: [],
    },
  };
};

export const useMarket = (uniqueKey: string, network: SupportedNetworks) => {
  return useQuery<MarketDetail>({
    queryKey: ['market', uniqueKey, network],
    queryFn: async () => {
      const response = await graphqlFetcher(marketDetailQuery, { uniqueKey, chainId: network });
      return processMarketData(response.data.marketByUniqueKey);
    },
  });
};

export const useMarketHistoricalData = (
  uniqueKey: string,
  network: SupportedNetworks,
  rateOptions: TimeseriesOptions,
  volumeOptions: TimeseriesOptions,
) => {
  const fetchHistoricalData = async (options: TimeseriesOptions) => {
    const response = await graphqlFetcher(marketHistoricalDataQuery, {
      uniqueKey,
      options,
      chainId: network,
    });
    return response.data.marketByUniqueKey.historicalState;
  };

  const rateQuery = useQuery({
    queryKey: ['marketHistoricalRates', uniqueKey, network, rateOptions],
    queryFn: async () => fetchHistoricalData(rateOptions),
  });

  const volumeQuery = useQuery({
    queryKey: ['marketHistoricalVolumes', uniqueKey, network, volumeOptions],
    queryFn: async () => fetchHistoricalData(volumeOptions),
  });

  return {
    data: {
      rates: rateQuery.data,
      volumes: volumeQuery.data,
    },
    isLoading: {
      rates: rateQuery.isLoading,
      volumes: volumeQuery.isLoading,
    },
    error: {
      rates: rateQuery.error,
      volumes: volumeQuery.error,
    },
    refetch: {
      rates: rateQuery.refetch,
      volumes: volumeQuery.refetch,
    },
  };
};

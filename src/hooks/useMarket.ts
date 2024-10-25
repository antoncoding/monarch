import { useQuery } from '@tanstack/react-query';
import { marketDetailQuery } from '../graphql/queries';
import { MarketDetail, TimeseriesOptions, Market } from '../utils/types';
import { getRewardPer1000USD } from '@/utils/morpho';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

const graphqlFetcher = async (query: string, variables: Record<string, unknown>) => {
  const response = await fetch('https://blue-api.morpho.org/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return result.data;
};

const processMarketData = (market: Market): MarketDetail => {
  const entry = market.state.rewards.find(
    (reward) => reward.asset.address.toLowerCase() === process.env.NEXT_PUBLIC_MORPHO_TOKEN_ADDRESS?.toLowerCase()
  );

  const warningsWithDetail = getMarketWarningsWithDetail(market);

  let rewardPer1000USD;
  if (entry) {
    const supplyAssetUSD = Number(market.state.supplyAssetsUsd);
    rewardPer1000USD = getRewardPer1000USD(entry.yearlySupplyTokens, supplyAssetUSD);
  }

  return {
    ...market,
    rewardPer1000USD,
    warningsWithDetail,
    isProtectedByLiquidationBots: false, // You might want to implement this check if needed
  } as MarketDetail;
};

export const useMarket = (uniqueKey: string, options: TimeseriesOptions) => {
  return useQuery<MarketDetail>({
    queryKey: ['market', uniqueKey, options],
    queryFn: async () => {
      const response = await graphqlFetcher(marketDetailQuery, {
        uniqueKey,
        options,
      });
      return processMarketData(response.marketByUniqueKey);
    },
  });
};

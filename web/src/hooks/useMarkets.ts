/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect } from 'react';
import { WhitelistMarketResponse } from '@/utils/types';

export type Reward = {
  id: string;
  net_reward_apr: null | string;
  reward_token_rates: {
    token: {
      address: string;
      symbol: string;
    };
    supply_rate: {
      token_amount_per1000_market_token: string; // with decimals
      token_amount_per1000_usd: string; // with decimals
    };
  }[];
};

export type Market = {
  id: string;
  lltv: string;
  uniqueKey: string;
  irmAddress: string;
  oracleAddress: string;
  collateralPrice: string;
  morphoBlue: {
    id: string;
    address: string;
    chain: {
      id: number;
    };
  };
  oracleInfo: {
    type: string;
    __typename: string;
  };
  oracleFeed: {
    baseFeedOneAddress: string;
    baseFeedOneDescription: string | null;
    baseFeedTwoAddress: string;
    baseFeedTwoDescription: string | null;
    quoteFeedOneAddress: string;
    quoteFeedOneDescription: string | null;
    quoteFeedTwoAddress: string;
    quoteFeedTwoDescription: string | null;
    __typename: string;
  };
  loanAsset: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    priceUsd: number;
    __typename: string;
  };
  collateralAsset: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    priceUsd: number;
    __typename: string;
  };
  state: {
    borrowAssets: string;
    supplyAssets: string;
    borrowAssetsUsd: string;
    supplyAssetsUsd: string;
    borrowShares: string;
    supplyShares: string;
    liquidityAssets: string;
    liquidityAssetsUsd: number;
    collateralAssets: string;
    utilization: number;
    supplyApy: number;
    borrowApy: number;
    fee: number;
    timestamp: number;
    rateAtUTarget: number;
    __typename: string;
  };
  warnings: {
    type: string;
    level: string;
    __typename: string;
  }[];
  __typename: string;

  rewardPer1000USD?: string;
};

const query = `query getMarkets(
  $first: Int, 
  $skip: Int, 
  $orderBy: MarketOrderBy, 
  $orderDirection: OrderDirection, 
  $where: MarketFilters
) { 
  markets(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    items {
      id
      lltv
      uniqueKey
      irmAddress
      oracleAddress
      collateralPrice
      morphoBlue {
          id
          address
          chain {
            id
            __typename
          }
          __typename
      }
      oracleInfo {
        type
        __typename
      }
      oracleFeed {
        baseFeedOneAddress
        baseFeedOneDescription
        baseFeedTwoAddress
        baseFeedTwoDescription
        quoteFeedOneAddress
        quoteFeedOneDescription
        quoteFeedTwoAddress
        quoteFeedTwoDescription
        __typename
      }
      loanAsset {
        id
        address
        symbol
        name
        decimals
        priceUsd
        __typename
      }
      collateralAsset {
        id
        address
        symbol
        name
        decimals
        priceUsd
        __typename
      }
      state {
        borrowAssets
        supplyAssets
        borrowAssetsUsd
        supplyAssetsUsd
        borrowShares
        supplyShares
        liquidityAssets
        liquidityAssetsUsd
        collateralAssets
        utilization
        supplyApy
        borrowApy
        fee
        timestamp
        rateAtUTarget
        __typename
      }
      warnings {
        type
        level
        __typename
      }
      __typename
    }
    pageInfo {
      countTotal
      count
      limit
      skip
      __typename
    }  
    __typename
  }
}`;

const useMarkets = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Market[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  console.log('data', data);

  console.log('error', error);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [response, whitelistRes] = await Promise.all([
          fetch('https://blue-api.morpho.org/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables: {
                first: 1000,
              },
            }),
          }),
          fetch('https://blue-services.morpho.org/whitelisting', {
            method: 'GET',
          }),
        ]);
        const result = await response.json();

        const whitelist = (await whitelistRes.json()) as WhitelistMarketResponse;

        const items = result.data.markets.items as Market[];

        const allWhitelistedMarketAddr = whitelist.mainnet.markets.map((market) => market.id);

        // batch fetch rewards https://rewards.morpho.org/rates/markets?ids=
        // each with 10 ids, otherwise the server breaks!

        // Split the array into chunks of 10
        const chunkSize = 10;
        const chunks = Array(Math.ceil(allWhitelistedMarketAddr.length / chunkSize))
          .fill([])
          .map((_, index) => {
            return allWhitelistedMarketAddr.slice(index * chunkSize, (index + 1) * chunkSize);
          });

        // Make a request for each chunk and concatenate the results
        const rewards = (
          await Promise.all(
            chunks.map(async (chunk) => {
              const rewardsRes = await fetch(
                `https://rewards.morpho.org/rates/markets?ids=${chunk.join(',')}`,
                {
                  method: 'GET',
                },
              );
              return (await rewardsRes.json()) as { markets: Reward[] };
            }),
          )
        ).reduce(
          (acc, res) => {
            return {
              markets: [...acc.markets, ...res.markets],
            };
          },
          { markets: [] as Reward[] },
        );

        // const rewardsRes = await fetch(
        //   `https://rewards.morpho.org/rates/markets?ids=${allWhitelistedMarketAddr.join(',')}`,
        //   {
        //     method: 'GET',
        //   },
        // );
        // const rewards = await rewardsRes.json() as {markets: Reward[]};

        const filtered = items
          .filter((market) => market.collateralAsset != undefined)
          .filter((market) => allWhitelistedMarketAddr.includes(market.uniqueKey));

        const final = filtered.map((market) => {
          const reward = rewards.markets.find((r) => r.id === market.uniqueKey);
          const rewardPer1000USD =
            reward?.reward_token_rates.find((r) => r.token.symbol === 'MORPHO')?.supply_rate
              .token_amount_per1000_usd ?? undefined;
          return {
            ...market,
            rewardPer1000USD,
          };
        });

        setData(final);
        setLoading(false);
      } catch (_error) {
        setError(_error);
        setLoading(false);
      }
    };

    fetchData().catch(console.error);
  }, []);

  return { loading, data, error };
};

export default useMarkets;

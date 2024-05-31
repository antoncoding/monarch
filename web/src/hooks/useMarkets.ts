/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect } from 'react';
import { formatBalance } from '@/utils/balance';
import { MORPHO } from '@/utils/tokens';
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
  };
  collateralAsset: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    priceUsd: number;
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
    rewards: {
      yearlySupplyTokens: string;
      asset: {
        address: string;
        priceUsd: string | null;
        spotPriceEth: string | null;
      };
      amountPerSuppliedToken: string;
      amountPerBorrowedToken: string;
    }[];
  };
  warnings: {
    type: string;
    level: string;
    __typename: string;
  }[];

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
        rewards {
          supplyApy
          yearlySupplyTokens
          asset {
            address
            priceUsd
            spotPriceEth
          }
          amountPerSuppliedToken
          amountPerBorrowedToken
        }
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

  console.log(
    'feed',
    data.find(
      (market) =>
        market.uniqueKey === '0xbd33e0ae076c82cfd0fa8d759ea83a296190f9f98d9f79b74a0eb4a294d8bf42',
    ),
  );

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

        const filtered = items
          .filter((market) => market.collateralAsset != undefined)
          .filter((market) => allWhitelistedMarketAddr.includes(market.uniqueKey));

        const final = filtered.map((market) => {
          const entry = market.state.rewards.find(
            (reward) => reward.asset.address.toLowerCase() === MORPHO.address.toLowerCase(),
          );

          if (!entry) {
            return { ...market, rewardPer1000USD: undefined };
          }

          const supplyAssetUSD = Number(market.state.supplyAssetsUsd);
          const rewardPer1000USD = (
            (formatBalance(entry.yearlySupplyTokens, MORPHO.decimals) / supplyAssetUSD) *
            1000
          ).toString();

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

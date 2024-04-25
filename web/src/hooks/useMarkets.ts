/* eslint-disable @typescript-eslint/no-unsafe-assignment */


import { useState, useEffect } from 'react';

type MarketData =  {
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
      __typename: string;
    };
    __typename: string;
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
}[];



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
}`

const useMarkets = () => {
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarketData | []>([]);
  const [error, setError] = useState<unknown|null>(null);

  console.log('error', error)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://blue-api.morpho.org/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            query, 
            variables: { 
              first: 1000
            }}),
        });
        const result = await response.json();

        const items = result.data.markets.items as MarketData;

        const filtered = items.filter(market => market.collateralAsset != undefined);

        setData(filtered);
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
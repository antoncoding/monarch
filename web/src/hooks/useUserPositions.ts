/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect } from 'react';

export type MarketPosition = {
  supplyShares: string
  supplyAssets: string
  supplyAssetsUsd: number
  borrowShares: string
  borrowAssets: string
  borrowAssetsUsd: number
  market: {
    id: string
    uniqueKey: string
    loanAsset: {
      address: string
      symbol: string
      decimals: number
    }
    collateralAsset: {
      address: string
      symbol: string
      decimals: number
    }
  }
};

const query = `query getUserMarketPositions(
  $address: String!
) {
  userByAddress(address: $address) {
    marketPositions {
      supplyShares
      supplyAssets
      supplyAssetsUsd
      borrowShares
      borrowAssets
      borrowAssetsUsd
      market {
        id
        uniqueKey
        loanAsset {
          address
          symbol
          decimals
        }
        collateralAsset{
          address
          symbol
          decimals
        }
      }
    }
  }
}`;


const useUserPositions = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  console.log('data', data);

  console.log('error', error);

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
                address: user,
              },
            }),
          })
        
          const result = await response.json();

        
        const items = result.data.userByAddress.marketPositions as MarketPosition[];

        setData(items);
        setLoading(false);
      } catch (_error) {
        setError(_error);
        setLoading(false);
      }
    };

    if (!user) return;

    fetchData().catch(console.error);
  }, []);

  return { loading, data, error };
};

export default useUserPositions;

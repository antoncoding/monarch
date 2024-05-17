/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect } from 'react';
import { MarketPosition, WhitelistMarketResponse } from '@/utils/types';


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
        lltv
        dailyApys {
          netSupplyApy
        }
        weeklyApys {
          netSupplyApy
        }
        monthlyApys {
          netSupplyApy
        }
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
        state {
          liquidityAssets
          supplyAssets
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
        const [response, whitelistRes] = await Promise.all([
          fetch('https://blue-api.morpho.org/graphql', {
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
          }),
          fetch('https://blue-services.morpho.org/whitelisting', {
            method: 'GET',
          }),
        ]);

        const result = await response.json();
        const whitelist = (await whitelistRes.json()) as WhitelistMarketResponse;

        const allPositions = result.data.userByAddress.marketPositions as MarketPosition[]
        const filtered = allPositions.filter((position: MarketPosition) => whitelist.mainnet.markets.some((market) => market.id === position.market.uniqueKey))

        setData(filtered);
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

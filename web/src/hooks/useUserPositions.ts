/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect } from 'react';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition } from '@/utils/types';

const query = `query getUserMarketPositions(
  $address: String!
  $chainId: Int
) {
  userByAddress(address: $address, chainId: $chainId) {
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
        oracleAddress
        irmAddress
        morphoBlue {
          id
          address
          chain {
            id
          }
        }
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
          supplyAssetsUsd
          supplyAssets
          rewards {
            yearlySupplyTokens
            asset {
              address
              priceUsd
              spotPriceEth
            }
          }
        }
      }
    }
  }
}`;

const useUserPositions = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [responseMainnet, responseBase] = await Promise.all([
          fetch('https://blue-api.morpho.org/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables: {
                address: user,
                chainId: SupportedNetworks.Mainnet
              },
            }),
          }),
          fetch('https://blue-api.morpho.org/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables: {
                address: user,
                chainId: SupportedNetworks.Base
              },
            }),
          }),
        ]);

        const result1 = await responseMainnet.json();
        const result2 = await responseBase.json();

        console.log('result2', result2)

        const allPositions = (result1.data.userByAddress.marketPositions as MarketPosition[]).concat(
          result2.data.userByAddress.marketPositions as MarketPosition[]
        );
        const filtered = allPositions.filter(
          (position: MarketPosition) => position.supplyShares.toString() !== '0',
          // whitelist.mainnet.markets.some((market) => market.id === position.market.uniqueKey) &&
        );

        setData(filtered);
        setLoading(false);
      } catch (_error) {
        setError(_error);
        setLoading(false);
      }
    };

    if (!user) return;

    fetchData().catch(console.error);
  }, [user]);

  return { loading, data, error };
};

export default useUserPositions;

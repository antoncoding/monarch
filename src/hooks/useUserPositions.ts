/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect } from 'react';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition, UserTransaction } from '@/utils/types';

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
    transactions {
      hash
      timestamp
      type
      data {
        __typename
        ... on MarketTransferTransactionData {
          assetsUsd
          shares
          assets
          market {
            id
            uniqueKey
            morphoBlue {
              chain {
                id
              }
            }
            collateralAsset {
              id
              address
              decimals
            }
            loanAsset {
              id
              address
              decimals
              symbol
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
  const [history, setHistory] = useState<UserTransaction[]>([]);
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
                chainId: SupportedNetworks.Mainnet,
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
                chainId: SupportedNetworks.Base,
              },
            }),
          }),
        ]);

        const result1 = await responseMainnet.json();
        const result2 = await responseBase.json();

        const marketPositions: MarketPosition[] = [];
        const transactions: UserTransaction[] = [];

        for (const result of [result1, result2]) {
          // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
          if (result.data && result.data.userByAddress) {
            marketPositions.push(
              ...(result.data.userByAddress.marketPositions as MarketPosition[]),
            );
            transactions.push(...(result.data.userByAddress.transactions as UserTransaction[]));
          }
        }

        const filtered = marketPositions.filter(
          (position: MarketPosition) => position.supplyShares.toString() !== '0',
        );

        setHistory(transactions);

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

  return { loading, data, history, error };
};

export default useUserPositions;

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect, useCallback } from 'react';
import { SupportedNetworks } from '@/utils/networks';
import { MarketPosition, UserTransaction } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';

const query = `
  fragment FeedFields on OracleFeed {
    address
    chain {
      id
    }
    description
    id
    pair
    vendor
  }

  query getUserMarketPositions(
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
          collateralAsset {
            address
            symbol
            decimals
          }
          state {
            liquidityAssets
            supplyAssetsUsd
            supplyAssets
            borrowAssets
            borrowAssetsUsd
            rewards {
              yearlySupplyTokens
              asset {
                address
                priceUsd
                spotPriceEth
              }
            }
            utilization
          }
          oracle {
            data {
              ... on MorphoChainlinkOracleData {
                baseFeedOne {
                  ...FeedFields
                }
                baseFeedTwo {
                  ...FeedFields
                }
                quoteFeedOne {
                  ...FeedFields
                }
                quoteFeedTwo {
                  ...FeedFields
                }
              }
              ... on MorphoChainlinkOracleV2Data {
                baseFeedOne {
                  ...FeedFields
                }
                baseFeedTwo {
                  ...FeedFields
                }
                quoteFeedOne {
                  ...FeedFields
                }
                quoteFeedTwo {
                  ...FeedFields
                }
              }
            }
          }
          oracleInfo {
            type
          }
          warnings {
            type
            level
            __typename
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
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<MarketPosition[]>([]);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const fetchData = useCallback(
    async (isRefetch = false) => {
      if (!user) return;

      try {
        if (isRefetch) {
          setIsRefetching(true);
        } else {
          setLoading(true);
        }

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

            const parsableTxs = (
              result.data.userByAddress.transactions as UserTransaction[]
            ).filter((t) => t.data?.market);
            transactions.push(...(parsableTxs as UserTransaction[]));
          }
        }

        const filtered = marketPositions
          .filter((position: MarketPosition) => position.supplyShares.toString() !== '0')
          .map((position: MarketPosition) => ({
            ...position,
            warningsWithDetail: getMarketWarningsWithDetail(position.market),
          }));

        setHistory(transactions);
        setData(filtered);
      } catch (_error) {
        setError(_error);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchData().catch(console.error);
  }, [fetchData]);

  const refetch = useCallback(
    (onSuccess?: () => void) => {
      fetchData(true).then(onSuccess).catch(console.error);
    },
    [fetchData],
  );

  return { loading, isRefetching, data, history, error, refetch };
};

export default useUserPositions;

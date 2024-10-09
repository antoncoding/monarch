/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getRewardPer1000USD } from '@/utils/morpho';
import { isSupportedChain } from '@/utils/networks';
import { MORPHOTokenAddress } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import useLiquidations from './useLiquidations';

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

const marketsQuery = `
  query getMarkets($first: Int, $where: MarketFilters) {
    markets(first: $first, where: $where) {
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
          baseVault
          baseVaultDescription
          baseVaultVendor
          quoteVault
          quoteVaultDescription
          quoteVaultVendor
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
          collateralAssetsUsd
          utilization
          supplyApy
          borrowApy
          fee
          timestamp
          rateAtUTarget
          rewards {
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
        badDebt {
          underlying
          usd
        }
        realizedBadDebt {
          underlying
          usd
        }
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
  }
`;

const useMarkets = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Market[]>([]);
  const [error, setError] = useState<unknown | null>(null);
  const {
    loading: liquidationsLoading,
    liquidatedMarketIds,
    error: liquidationsError,
  } = useLiquidations();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch markets
      const marketsResponse = await fetch('https://blue-api.morpho.org/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: marketsQuery,
          variables: { first: 1000, where: { whitelisted: true } },
        }),
      });
      const marketsResult = await marketsResponse.json();
      const markets = marketsResult.data.markets.items as Market[];

      const filtered = markets
        .filter((market) => market.collateralAsset != undefined)
        .filter(
          (market) => market.warnings.find((w) => w.type === 'not_whitelisted') === undefined,
        )
        .filter((market) => isSupportedChain(market.morphoBlue.chain.id));

      const final = filtered.map((market) => {
        const entry = market.state.rewards.find(
          (reward) => reward.asset.address.toLowerCase() === MORPHOTokenAddress.toLowerCase(),
        );

        const warningsWithDetail = getMarketWarningsWithDetail(market);
        const isProtectedByLiquidationBots = liquidatedMarketIds.has(market.id);

        if (!entry) {
          return {
            ...market,
            rewardPer1000USD: undefined,
            warningsWithDetail,
            isProtectedByLiquidationBots,
          };
        }

        const supplyAssetUSD = Number(market.state.supplyAssetsUsd);
        const rewardPer1000USD = getRewardPer1000USD(entry.yearlySupplyTokens, supplyAssetUSD);

        return {
          ...market,
          rewardPer1000USD,
          warningsWithDetail,
          isProtectedByLiquidationBots,
        };
      });

      setData(final);
      setLoading(false);
    } catch (_error) {
      setError(_error);
      setLoading(false);
    }
  }, [liquidatedMarketIds]);

  useEffect(() => {
    if (!liquidationsLoading) {
      fetchData().catch(console.error);
    }
  }, [liquidationsLoading, fetchData]);

  const refetch = useCallback(() => {
    fetchData().catch(console.error);
  }, [fetchData]);

  const isLoading = loading || liquidationsLoading;
  const combinedError = error || liquidationsError;

  return { loading: isLoading, data, error: combinedError, refetch };
};

export default useMarkets;

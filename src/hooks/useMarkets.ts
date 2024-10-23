/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { marketsQuery } from '@/graphql/queries';
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

const useMarkets = () => {
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState<Market[]>([]);
  const [error, setError] = useState<unknown | null>(null);
  const {
    loading: liquidationsLoading,
    liquidatedMarketIds,
    error: liquidationsError,
    refetch: refetchLiquidations,
  } = useLiquidations();

  console.log('data', data);

  const fetchData = useCallback(
    async (isRefetch = false) => {
      try {
        if (isRefetch) {
          setIsRefetching(true);
        } else {
          setLoading(true);
        }

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
      } catch (_error) {
        setError(_error);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [liquidatedMarketIds],
  );

  useEffect(() => {
    if (!liquidationsLoading) {
      fetchData().catch(console.error);
    }
  }, [liquidationsLoading, fetchData]);

  const refetch = useCallback(
    (onSuccess?: () => void) => {
      refetchLiquidations();
      fetchData(true).then(onSuccess).catch(console.error);
    },
    [refetchLiquidations, fetchData],
  );

  const isLoading = loading || liquidationsLoading;
  const combinedError = error || liquidationsError;

  return { loading: isLoading, isRefetching, data, error: combinedError, refetch };
};

export default useMarkets;

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCompletedPositionDailyAnalytics, type PositionDailyAnalytics } from '@/data-sources/monarch-api';
import type { EarningsTimeRange } from '@/utils/earnings-period';
import type { MarketPosition } from '@/utils/types';

type UsePositionDailyAnalyticsQueryOptions = {
  userAddress: string | undefined;
  positions: MarketPosition[] | undefined;
  range: EarningsTimeRange;
  enabled: boolean;
};

export const usePositionDailyAnalyticsQuery = ({ userAddress, positions, range, enabled }: UsePositionDailyAnalyticsQueryOptions) => {
  const marketsByChain = useMemo(() => {
    const result = new Map<number, Set<string>>();

    for (const position of positions ?? []) {
      const chainId = position.market.morphoBlue.chain.id;
      const marketIds = result.get(chainId) ?? new Set<string>();
      marketIds.add(position.market.uniqueKey.toLowerCase());
      result.set(chainId, marketIds);
    }

    return [...result.entries()]
      .map(([chainId, marketIds]) => [chainId, [...marketIds].sort()] as const)
      .sort(([leftChainId], [rightChainId]) => leftChainId - rightChainId);
  }, [positions]);

  return useQuery<Record<number, PositionDailyAnalytics>>({
    queryKey: ['position-daily-analytics', userAddress?.toLowerCase(), marketsByChain, range.startTimestamp, range.endTimestamp],
    queryFn: async () => {
      if (!userAddress) return {};

      const entries = await Promise.all(
        marketsByChain.map(async ([chainId, marketIds]) => {
          const analytics = await fetchCompletedPositionDailyAnalytics({
            userAddress,
            chainId,
            marketIds,
            startTimestamp: range.startTimestamp,
            endTimestamp: range.endTimestamp,
          });
          return [chainId, analytics] as const;
        }),
      );

      return Object.fromEntries(entries);
    },
    enabled: enabled && Boolean(userAddress) && marketsByChain.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

import { useQuery } from '@tanstack/react-query';
import { fetchMonarchMarketTxContextsInWindow, type MarketProActivity } from '@/data-sources/monarch-api';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

const MARKET_FLOW_ACTIVITY_PAGE_SIZE = 250;
const MARKET_FLOW_ACTIVITY_MAX_ROWS = 1250;

type MarketFlowActivitiesResult = {
  activities: MarketProActivity[];
};

export const useMarketFlowActivities = (
  marketId: string | undefined,
  network: SupportedNetworks | undefined,
  timeRange: TimeseriesOptions,
) => {
  return useQuery<MarketFlowActivitiesResult>({
    queryKey: ['marketFlowActivities', marketId, network, timeRange.startTimestamp, timeRange.endTimestamp, MARKET_FLOW_ACTIVITY_MAX_ROWS],
    queryFn: async () => {
      if (!marketId || !network) {
        return { activities: [] };
      }

      const activities: MarketProActivity[] = [];
      let skip = 0;
      let hasNextPage = true;

      while (hasNextPage && activities.length < MARKET_FLOW_ACTIVITY_MAX_ROWS) {
        const page = await fetchMonarchMarketTxContextsInWindow(
          marketId,
          network,
          timeRange.startTimestamp,
          timeRange.endTimestamp,
          MARKET_FLOW_ACTIVITY_PAGE_SIZE,
          skip,
        );

        activities.push(...page.items);
        hasNextPage = page.hasNextPage;
        skip += MARKET_FLOW_ACTIVITY_PAGE_SIZE;
      }

      return {
        activities: activities.slice(0, MARKET_FLOW_ACTIVITY_MAX_ROWS),
      };
    },
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
};

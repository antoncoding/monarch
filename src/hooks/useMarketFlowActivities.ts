import { useQuery } from '@tanstack/react-query';
import { fetchMonarchMarketTxContextsInWindow, type MarketProActivity } from '@/data-sources/monarch-api';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

const MARKET_FLOW_ACTIVITY_PAGE_SIZE = 500;
const MARKET_FLOW_ACTIVITY_MAX_ROWS = 1250;
const MARKET_FLOW_ACTIVITY_PAGE_OVERLAP = 3;

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

      const activitiesByKey = new Map<string, MarketProActivity>();
      let skip = 0;
      let hasNextPage = true;

      while (hasNextPage && activitiesByKey.size < MARKET_FLOW_ACTIVITY_MAX_ROWS) {
        const page = await fetchMonarchMarketTxContextsInWindow(
          marketId,
          network,
          timeRange.startTimestamp,
          timeRange.endTimestamp,
          MARKET_FLOW_ACTIVITY_PAGE_SIZE,
          skip,
        );

        for (const activity of page.items) {
          activitiesByKey.set(`${activity.chainId}:${activity.id}`, activity);
        }

        hasNextPage = page.hasNextPage;
        if (page.items.length === 0) {
          break;
        }

        // Re-read a small overlap so offset drift cannot double-count after dedupe.
        skip += MARKET_FLOW_ACTIVITY_PAGE_SIZE - MARKET_FLOW_ACTIVITY_PAGE_OVERLAP;
      }

      return {
        activities: [...activitiesByKey.values()].slice(0, MARKET_FLOW_ACTIVITY_MAX_ROWS),
      };
    },
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
};

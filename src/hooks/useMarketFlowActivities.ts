import { useQuery } from '@tanstack/react-query';
import { fetchMonarchMarketFlowEventsInWindow, type MarketFlowEvent, type MarketFlowKind } from '@/data-sources/monarch-api';
import type { SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

const MARKET_FLOW_EVENT_PAGE_SIZE = 999;
const MARKET_FLOW_EVENT_MAX_ROWS_PER_DIRECTION = 10_000;
const MARKET_FLOW_EVENT_PAGE_OVERLAP = 3;

type MarketFlowActivitiesResult = {
  activities: MarketFlowEvent[];
};

export const useMarketFlowActivities = (
  marketId: string | undefined,
  network: SupportedNetworks | undefined,
  timeRange: TimeseriesOptions,
  flowKind: MarketFlowKind,
) => {
  return useQuery<MarketFlowActivitiesResult>({
    queryKey: ['marketFlowActivities', marketId, network, flowKind, timeRange.startTimestamp, timeRange.endTimestamp],
    queryFn: async () => {
      if (!marketId || !network) {
        return { activities: [] };
      }

      const activitiesByKey = new Map<string, MarketFlowEvent>();
      let skip = 0;
      let hasNextPage = true;

      while (hasNextPage && skip < MARKET_FLOW_EVENT_MAX_ROWS_PER_DIRECTION) {
        const pageSize = Math.min(MARKET_FLOW_EVENT_PAGE_SIZE, MARKET_FLOW_EVENT_MAX_ROWS_PER_DIRECTION - skip);
        const page = await fetchMonarchMarketFlowEventsInWindow(
          marketId,
          network,
          flowKind,
          timeRange.startTimestamp,
          timeRange.endTimestamp,
          pageSize,
          skip,
        );

        for (const activity of page.items) {
          activitiesByKey.set(activity.id, activity);
        }

        hasNextPage = page.hasNextPage;
        if (pageSize < MARKET_FLOW_EVENT_PAGE_SIZE) {
          break;
        }

        // Re-read a small overlap so offset drift is deduped instead of skipping boundary rows.
        skip += MARKET_FLOW_EVENT_PAGE_SIZE - MARKET_FLOW_EVENT_PAGE_OVERLAP;
      }

      return {
        activities: [...activitiesByKey.values()],
      };
    },
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

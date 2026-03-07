import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TimeFrame } from '@/hooks/useMonarchTransactions';

const TIMEFRAME_TO_SECONDS: Record<TimeFrame, number> = {
  '1D': 24 * 60 * 60,
  '7D': 7 * 24 * 60 * 60,
  '30D': 30 * 24 * 60 * 60,
  '90D': 90 * 24 * 60 * 60,
  ALL: 365 * 24 * 60 * 60,
};

export type AttributionScoreboardSummary = {
  qualifiedLeads: number;
  activatedAccounts: number;
  activationRate: number;
  attributedVolumeUsd: number;
  attributedRevenueUsd: number;
  distributionCostUsd: number;
  cacPaybackDays: number | null;
};

export type AttributionScoreboardRow = AttributionScoreboardSummary & {
  source: string;
  medium: string;
  campaign: string;
  refCode: string;
};

export type AttributionScoreboardResponse = {
  startTimestamp: number;
  endTimestamp: number;
  windowDays: number;
  revenueBps: number;
  summary: AttributionScoreboardSummary;
  breakdown: AttributionScoreboardRow[];
};

function getTimeRange(timeframe: TimeFrame): { startTimestamp: number; endTimestamp: number } {
  const now = Math.floor(Date.now() / 1000);
  return {
    startTimestamp: now - TIMEFRAME_TO_SECONDS[timeframe],
    endTimestamp: now,
  };
}

async function fetchAttributionScoreboard(timeframe: TimeFrame): Promise<AttributionScoreboardResponse> {
  const { startTimestamp, endTimestamp } = getTimeRange(timeframe);
  const searchParams = new URLSearchParams({
    start_ts: String(startTimestamp),
    end_ts: String(endTimestamp),
  });

  const response = await fetch(`/api/monarch/attribution/scoreboard?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch attribution scoreboard');
  }

  return response.json();
}

export function useAttributionScoreboard(timeframe: TimeFrame) {
  const query = useQuery({
    queryKey: ['attribution-scoreboard', timeframe],
    queryFn: () => fetchAttributionScoreboard(timeframe),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const summary = useMemo(() => {
    return (
      query.data?.summary ?? {
        qualifiedLeads: 0,
        activatedAccounts: 0,
        activationRate: 0,
        attributedVolumeUsd: 0,
        attributedRevenueUsd: 0,
        distributionCostUsd: 0,
        cacPaybackDays: null,
      }
    );
  }, [query.data?.summary]);

  return {
    ...query,
    summary,
    breakdown: query.data?.breakdown ?? [],
  };
}

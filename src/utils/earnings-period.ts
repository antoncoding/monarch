import type { EarningsPeriod } from '@/stores/usePositionsFilters';

export type EarningsTimeRange = {
  startTimestamp: number;
  endTimestamp: number;
};

const SECONDS_PER_DAY = 86_400;

const COMPLETED_PERIOD_DAYS: Partial<Record<EarningsPeriod, number>> = {
  week: 7,
  month: 30,
  threemonth: 90,
  sixmonth: 180,
};

export const usesCompletedUtcDays = (period: EarningsPeriod): boolean => COMPLETED_PERIOD_DAYS[period] !== undefined;
export const isRollingEarningsPeriod = (period: EarningsPeriod): boolean => period === 'day';

export const getEarningsTimeRange = (period: EarningsPeriod, nowTimestamp: number = Math.floor(Date.now() / 1000)): EarningsTimeRange => {
  // 24H is the only rolling preset. Every longer bounded preset uses completed UTC days.
  if (isRollingEarningsPeriod(period)) {
    return { startTimestamp: nowTimestamp - SECONDS_PER_DAY, endTimestamp: nowTimestamp };
  }

  const completedDays = COMPLETED_PERIOD_DAYS[period];
  if (completedDays !== undefined) {
    const endTimestamp = Math.floor(nowTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
    return {
      startTimestamp: endTimestamp - completedDays * SECONDS_PER_DAY,
      endTimestamp,
    };
  }

  return {
    startTimestamp: 0,
    endTimestamp: nowTimestamp,
  };
};

const formatUtcTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(timestamp * 1000))
    .replace('24:00', '00:00');

export const formatEarningsTimeRange = (period: EarningsPeriod, range: EarningsTimeRange): string => {
  const end = `${formatUtcTimestamp(range.endTimestamp)} UTC`;

  if (period === 'all') {
    return `All indexed activity through ${end}`;
  }

  const start = `${formatUtcTimestamp(range.startTimestamp)} UTC`;
  const prefix = isRollingEarningsPeriod(period) ? 'Rolling 24H' : 'Completed UTC days';
  return `${prefix}: ${start} – ${end}`;
};

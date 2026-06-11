import { ADMIN_MARKET_GROUPS, type AdminMarketGroupConfig } from '@/features/admin-v2/market-groups';
import type { EnrichedBorrowTransaction, EnrichedSupplyTransaction } from '@/hooks/useMonarchTransactions';

export type MarketGroupVolumeStats = {
  id: string;
  label: string;
  description?: string;
  marketCount: number;
  supplyVolumeUsd: number;
  borrowVolumeUsd: number;
  totalVolumeUsd: number;
  supplyCount: number;
  borrowCount: number;
};

export type MarketGroupWeeklyVolume = {
  timestamp: number;
  groups: Record<
    string,
    {
      id: string;
      label: string;
      supplyVolumeUsd: number;
      borrowVolumeUsd: number;
      totalVolumeUsd: number;
      supplyCount: number;
      borrowCount: number;
    }
  >;
};

type SupplyBorrowTransaction = EnrichedSupplyTransaction | EnrichedBorrowTransaction;

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;

const normalize = (value: string | undefined): string => value?.trim().toLowerCase() ?? '';

const getChainMarketId = (tx: SupplyBorrowTransaction): string => `${tx.chainId}:${normalize(tx.marketId)}`;

const getUtcWeekStartTimestamp = (timestamp: number): number => {
  const date = new Date(timestamp * 1000);
  date.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return Math.floor(date.getTime() / 1000);
};

const matchesConfiguredMarketId = (tx: SupplyBorrowTransaction, group: AdminMarketGroupConfig): boolean => {
  if (!group.marketIds?.length) return false;

  const marketId = normalize(tx.marketId);
  const chainMarketId = getChainMarketId(tx);
  return group.marketIds.some((configuredMarketId) => {
    const normalizedConfiguredMarketId = normalize(configuredMarketId);
    return normalizedConfiguredMarketId === marketId || normalizedConfiguredMarketId === chainMarketId;
  });
};

const matchesConfiguredSymbol = (
  value: string | undefined,
  configuredSymbols: AdminMarketGroupConfig['loanAssetSymbols'] | AdminMarketGroupConfig['collateralAssetSymbols'],
): boolean => {
  if (!configuredSymbols?.length) return false;

  const normalizedValue = normalize(value);
  return configuredSymbols.some((symbol) => normalize(symbol) === normalizedValue);
};

const findMarketGroup = (tx: SupplyBorrowTransaction, groups: readonly AdminMarketGroupConfig[]): AdminMarketGroupConfig | undefined => {
  return groups.find((group) => {
    if (matchesConfiguredMarketId(tx, group)) return true;
    if (matchesConfiguredSymbol(tx.market?.loanAsset.symbol ?? tx.loanSymbol, group.loanAssetSymbols)) return true;
    return matchesConfiguredSymbol(tx.market?.collateralAsset.symbol, group.collateralAssetSymbols);
  });
};

export const getMarketGroupVolumeStats = ({
  supplies,
  borrows,
  groups = ADMIN_MARKET_GROUPS,
}: {
  supplies: readonly EnrichedSupplyTransaction[];
  borrows: readonly EnrichedBorrowTransaction[];
  groups?: readonly AdminMarketGroupConfig[];
}): MarketGroupVolumeStats[] => {
  const statsMap = new Map<string, MarketGroupVolumeStats & { marketIds: Set<string> }>();

  const getStats = (group: AdminMarketGroupConfig) => {
    const existing = statsMap.get(group.id);
    if (existing) return existing;

    const created = {
      id: group.id,
      label: group.label,
      description: group.description,
      marketCount: 0,
      supplyVolumeUsd: 0,
      borrowVolumeUsd: 0,
      totalVolumeUsd: 0,
      supplyCount: 0,
      borrowCount: 0,
      marketIds: new Set<string>(),
    };
    statsMap.set(group.id, created);
    return created;
  };

  const addTransaction = (tx: SupplyBorrowTransaction) => {
    const group = findMarketGroup(tx, groups);
    if (!group) return;

    const stats = getStats(group);
    stats.marketIds.add(getChainMarketId(tx));

    if (tx.type === 'supply') {
      stats.supplyVolumeUsd += tx.usdValue;
      stats.supplyCount += 1;
    } else {
      stats.borrowVolumeUsd += tx.usdValue;
      stats.borrowCount += 1;
    }

    stats.totalVolumeUsd += tx.usdValue;
  };

  for (const tx of supplies) {
    addTransaction(tx);
  }

  for (const tx of borrows) {
    addTransaction(tx);
  }

  return Array.from(statsMap.values())
    .map(({ marketIds, ...stats }) => ({
      ...stats,
      marketCount: marketIds.size,
    }))
    .filter((stats) => stats.totalVolumeUsd > 0)
    .sort((left, right) => right.totalVolumeUsd - left.totalVolumeUsd);
};

export const getMarketGroupWeeklyVolumes = ({
  supplies,
  borrows,
  groups = ADMIN_MARKET_GROUPS,
}: {
  supplies: readonly EnrichedSupplyTransaction[];
  borrows: readonly EnrichedBorrowTransaction[];
  groups?: readonly AdminMarketGroupConfig[];
}): MarketGroupWeeklyVolume[] => {
  const weekMap = new Map<number, MarketGroupWeeklyVolume>();

  const getWeek = (timestamp: number) => {
    const weekTimestamp = getUtcWeekStartTimestamp(timestamp);
    const existing = weekMap.get(weekTimestamp);
    if (existing) return existing;

    const created = {
      timestamp: weekTimestamp,
      groups: {},
    };
    weekMap.set(weekTimestamp, created);
    return created;
  };

  const getWeeklyGroup = (week: MarketGroupWeeklyVolume, group: AdminMarketGroupConfig) => {
    const existing = week.groups[group.id];
    if (existing) return existing;

    const created = {
      id: group.id,
      label: group.label,
      supplyVolumeUsd: 0,
      borrowVolumeUsd: 0,
      totalVolumeUsd: 0,
      supplyCount: 0,
      borrowCount: 0,
    };
    week.groups[group.id] = created;
    return created;
  };

  const addTransaction = (tx: SupplyBorrowTransaction) => {
    const group = findMarketGroup(tx, groups);
    if (!group) return;

    const week = getWeek(tx.timestamp);
    const weeklyGroup = getWeeklyGroup(week, group);

    if (tx.type === 'supply') {
      weeklyGroup.supplyVolumeUsd += tx.usdValue;
      weeklyGroup.supplyCount += 1;
    } else {
      weeklyGroup.borrowVolumeUsd += tx.usdValue;
      weeklyGroup.borrowCount += 1;
    }

    weeklyGroup.totalVolumeUsd += tx.usdValue;
  };

  for (const tx of supplies) {
    addTransaction(tx);
  }

  for (const tx of borrows) {
    addTransaction(tx);
  }

  if (weekMap.size === 0) return [];

  const sortedWeekTimestamps = Array.from(weekMap.keys()).sort((left, right) => left - right);
  const startWeek = sortedWeekTimestamps[0];
  const endWeek = sortedWeekTimestamps.at(-1);
  if (startWeek === undefined || endWeek === undefined) return [];

  const weeks: MarketGroupWeeklyVolume[] = [];
  for (let timestamp = startWeek; timestamp <= endWeek; timestamp += SECONDS_PER_WEEK) {
    weeks.push(
      weekMap.get(timestamp) ?? {
        timestamp,
        groups: {},
      },
    );
  }

  return weeks;
};

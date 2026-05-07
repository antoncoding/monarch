import { formatUnits } from 'viem';
import {
  getOracleFromMetadata,
  type EnrichedFeed,
  type EnrichedVault,
  type OracleMetadataRecord,
  type OracleOutput,
  type OracleOutputData,
} from '@/hooks/useOracleMetadata';
import type { Market } from '@/utils/types';

export type FeedDependencyKind = 'feed' | 'vault';
export type FeedDependencySource = 'standard' | 'primary' | 'backup';
export type FeedDependencyRole = 'baseFeedOne' | 'baseFeedTwo' | 'quoteFeedOne' | 'quoteFeedTwo' | 'baseVault' | 'quoteVault';

export type FeedDependencyLeg = (EnrichedFeed | EnrichedVault) & {
  address: string;
  description?: string;
  provider?: string | null;
  vendor?: string;
  feedType?: string;
  decimals?: number;
  tier?: string;
  heartbeat?: number;
  deviationThreshold?: number;
  ens?: string;
  riskTier?: number;
  updateInterval?: number;
  updateSpread?: number;
  conversionSample?: string;
  symbol?: string;
  asset?: string;
  assetSymbol?: string;
  oracleType?: string;
  pair?: [string, string] | [];
};

export type FeedDependencyOccurrence = {
  oracle: OracleOutput;
  source: FeedDependencySource;
  sourceLabel: string;
  role: FeedDependencyRole;
  roleLabel: string;
  kind: FeedDependencyKind;
  leg: FeedDependencyLeg;
  isActiveSource: boolean;
};

export type FeedMarketDependency = {
  market: Market;
  occurrences: FeedDependencyOccurrence[];
};

type DataLeg = {
  role: FeedDependencyRole;
  roleLabel: string;
  kind: FeedDependencyKind;
  leg: FeedDependencyLeg | null;
};

const DATA_LEGS: { role: FeedDependencyRole; roleLabel: string; kind: FeedDependencyKind }[] = [
  { role: 'baseVault', roleLabel: 'Base vault', kind: 'vault' },
  { role: 'baseFeedOne', roleLabel: 'Base feed 1', kind: 'feed' },
  { role: 'baseFeedTwo', roleLabel: 'Base feed 2', kind: 'feed' },
  { role: 'quoteVault', roleLabel: 'Quote vault', kind: 'vault' },
  { role: 'quoteFeedOne', roleLabel: 'Quote feed 1', kind: 'feed' },
  { role: 'quoteFeedTwo', roleLabel: 'Quote feed 2', kind: 'feed' },
];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function normalizeAddress(value: string | null | undefined): string {
  return value?.toLowerCase() ?? '';
}

export function isNonZeroAddress(value: string | null | undefined): boolean {
  const normalized = normalizeAddress(value);
  return normalized.length > 0 && normalized !== ZERO_ADDRESS;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getOracleDataLegs(data: OracleOutputData | null): DataLeg[] {
  if (!data) return [];

  return DATA_LEGS.map(({ role, roleLabel, kind }) => ({
    role,
    roleLabel,
    kind,
    leg: (data[role] as FeedDependencyLeg | null) ?? null,
  }));
}

function addMatchingDataLegs({
  matches,
  oracle,
  data,
  targetAddress,
  source,
  sourceLabel,
  isActiveSource,
}: {
  matches: FeedDependencyOccurrence[];
  oracle: OracleOutput;
  data: OracleOutputData | null;
  targetAddress: string;
  source: FeedDependencySource;
  sourceLabel: string;
  isActiveSource: boolean;
}) {
  for (const { role, roleLabel, kind, leg } of getOracleDataLegs(data)) {
    if (!leg?.address || normalizeAddress(leg.address) !== targetAddress) continue;

    matches.push({
      oracle,
      source,
      sourceLabel,
      role,
      roleLabel,
      kind,
      leg,
      isActiveSource,
    });
  }
}

export function getFeedOccurrencesForOracle(oracle: OracleOutput | undefined, feedAddress: string): FeedDependencyOccurrence[] {
  if (!oracle || !isNonZeroAddress(feedAddress)) return [];

  const targetAddress = normalizeAddress(feedAddress);
  const matches: FeedDependencyOccurrence[] = [];

  if (oracle.type === 'standard') {
    addMatchingDataLegs({
      matches,
      oracle,
      data: oracle.data,
      targetAddress,
      source: 'standard',
      sourceLabel: 'Standard oracle',
      isActiveSource: true,
    });
  }

  if (oracle.type === 'meta') {
    const primaryIsActive = normalizeAddress(oracle.data.currentOracle) === normalizeAddress(oracle.data.primaryOracle);
    const backupIsActive = normalizeAddress(oracle.data.currentOracle) === normalizeAddress(oracle.data.backupOracle);

    addMatchingDataLegs({
      matches,
      oracle,
      data: oracle.data.oracleSources.primary,
      targetAddress,
      source: 'primary',
      sourceLabel: 'Primary oracle',
      isActiveSource: primaryIsActive,
    });
    addMatchingDataLegs({
      matches,
      oracle,
      data: oracle.data.oracleSources.backup,
      targetAddress,
      source: 'backup',
      sourceLabel: 'Backup oracle',
      isActiveSource: backupIsActive,
    });
  }

  return matches;
}

export function findFeedOccurrences(
  metadataRecord: OracleMetadataRecord | undefined,
  feedAddress: string,
  chainId?: number,
): FeedDependencyOccurrence[] {
  if (!metadataRecord || !isNonZeroAddress(feedAddress)) return [];

  const matches: FeedDependencyOccurrence[] = [];
  for (const oracle of Object.values(metadataRecord)) {
    if (chainId != null && oracle.chainId !== chainId) continue;
    matches.push(...getFeedOccurrencesForOracle(oracle, feedAddress));
  }

  return matches;
}

export function findFeedMarketDependencies({
  markets,
  metadataRecord,
  feedAddress,
  chainId,
}: {
  markets: Market[] | undefined;
  metadataRecord: OracleMetadataRecord | undefined;
  feedAddress: string;
  chainId: number;
}): FeedMarketDependency[] {
  if (!markets || !metadataRecord || !isNonZeroAddress(feedAddress)) return [];

  const rows: FeedMarketDependency[] = [];
  for (const market of markets) {
    if (market.morphoBlue.chain.id !== chainId) continue;

    const oracle = getOracleFromMetadata(metadataRecord, market.oracleAddress, chainId);
    const occurrences = getFeedOccurrencesForOracle(oracle, feedAddress);
    if (occurrences.length === 0) continue;

    rows.push({ market, occurrences });
  }

  return rows.sort((left, right) => {
    const rightExposure =
      toFiniteNumber(right.market.state?.supplyAssetsUsd) + toFiniteNumber(right.market.state?.borrowAssetsUsd);
    const leftExposure =
      toFiniteNumber(left.market.state?.supplyAssetsUsd) + toFiniteNumber(left.market.state?.borrowAssetsUsd);
    return rightExposure - leftExposure;
  });
}

export function getRepresentativeLeg(occurrences: FeedDependencyOccurrence[]): FeedDependencyLeg | null {
  return occurrences.find((occurrence) => occurrence.leg.description || occurrence.leg.pair?.length)?.leg ?? occurrences[0]?.leg ?? null;
}

export function getFeedPairLabel(leg: FeedDependencyLeg | null): string {
  const base = leg?.pair?.[0];
  const quote = leg?.pair?.[1];
  if (base && quote) return `${base} / ${quote}`;
  if (leg && 'symbol' in leg && 'assetSymbol' in leg) return `${leg.symbol} / ${leg.assetSymbol}`;
  return 'Unknown pair';
}

export function getFeedTitle(leg: FeedDependencyLeg | null, address: string): string {
  const pairLabel = getFeedPairLabel(leg);
  if (pairLabel !== 'Unknown pair') return pairLabel;
  if (leg?.description) return leg.description;
  return shortenAddress(address);
}

export function getFeedProviderLabel(leg: FeedDependencyLeg | null): string {
  return leg?.provider ?? leg?.vendor ?? 'Unknown provider';
}

export function getFeedDescription(leg: FeedDependencyLeg | null): string {
  if (!leg) return 'No scanner metadata found for this feed leg yet.';
  return leg.description ?? `${getFeedProviderLabel(leg)} dependency used inside Morpho oracle routes.`;
}

export function getOccurrenceLabel(occurrence: FeedDependencyOccurrence): string {
  const activeSuffix = occurrence.source === 'standard' ? '' : occurrence.isActiveSource ? ' active' : ' standby';
  return `${occurrence.sourceLabel}${activeSuffix}, ${occurrence.roleLabel}`;
}

export function toFiniteNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatUsdCompact(value: unknown): string {
  const safeValue = toFiniteNumber(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(safeValue) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(safeValue) >= 100_000 ? 2 : 2,
  }).format(safeValue);
}

export function formatPercentValue(value: unknown, maximumFractionDigits = 2): string {
  const safeValue = toFiniteNumber(value);
  return `${(safeValue * 100).toLocaleString('en-US', { maximumFractionDigits })}%`;
}

export function formatLltv(lltv: string): string {
  return `${formatUnits(BigInt(lltv), 16)}%`;
}

export function getUniqueOracleOccurrences(occurrences: FeedDependencyOccurrence[]): FeedDependencyOccurrence[] {
  const byOracle = new Map<string, FeedDependencyOccurrence>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.oracle.chainId}-${normalizeAddress(occurrence.oracle.address)}`;
    if (!byOracle.has(key)) {
      byOracle.set(key, occurrence);
    }
  }
  return Array.from(byOracle.values());
}

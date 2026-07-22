import { buildEnvioPositionDailyFlowsPageQuery } from '@/graphql/envio-queries';
import { monarchGraphqlFetcher } from './fetchers';

type PositionDailyFlow = {
  id: string;
  marketId: string;
  lastActivityTimestamp: number;
  netSupplyAssets: string;
};

type PositionDailyFlowRow = Omit<PositionDailyFlow, 'lastActivityTimestamp'> & {
  bucketStart: string;
  lastActivityTimestamp: string;
};

type PositionDailyFlowsResponse = {
  data?: {
    PositionDailyFlow?: PositionDailyFlowRow[];
  };
};

const SECONDS_PER_DAY = 86_400;
const PAGE_SIZE = 1_000;
const MAX_PAGES = 50;

const getDayStart = (timestamp: number): number => Math.floor(timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;

export async function fetchPositionDailyFlows({
  userAddress,
  chainId,
  marketIds,
  startTimestamp,
  endTimestamp,
  includeCurrentBucket = false,
}: {
  userAddress: string;
  chainId: number;
  marketIds: string[];
  startTimestamp: number;
  endTimestamp: number;
  includeCurrentBucket?: boolean;
}): Promise<PositionDailyFlow[]> {
  const startBucket = getDayStart(startTimestamp);
  const currentBucket = getDayStart(Math.floor(Date.now() / 1000));
  const shouldIncludeCurrentBucket = includeCurrentBucket && endTimestamp >= currentBucket;
  // All-time history excludes the mutable current bucket so pagination stays
  // stable. Bounded charts include it to avoid a stale penultimate point; the
  // live on-chain position remains the final source of truth.
  const lastBucket = shouldIncludeCurrentBucket ? currentBucket + SECONDS_PER_DAY : currentBucket;
  const requestedEndBucket = getDayStart(endTimestamp) + (shouldIncludeCurrentBucket ? SECONDS_PER_DAY : 0);
  const endBucket = Math.min(requestedEndBucket, lastBucket);
  if (marketIds.length === 0 || endBucket <= startBucket) {
    return [];
  }

  const flows: PositionDailyFlow[] = [];
  let cursor: { bucketStart: string; id: string } | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await monarchGraphqlFetcher<PositionDailyFlowsResponse>(buildEnvioPositionDailyFlowsPageQuery(Boolean(cursor)), {
      user: userAddress.toLowerCase(),
      chainId,
      marketIds: marketIds.map((marketId) => marketId.toLowerCase()),
      startBucket: String(startBucket),
      endBucket: String(endBucket),
      limit: PAGE_SIZE,
      ...(cursor ? { cursorBucket: cursor.bucketStart, cursorId: cursor.id } : {}),
    });
    const rows = response.data?.PositionDailyFlow ?? [];

    for (const row of rows) {
      flows.push({
        id: row.id,
        marketId: row.marketId,
        lastActivityTimestamp: Number(row.lastActivityTimestamp),
        netSupplyAssets: row.netSupplyAssets,
      });
    }

    if (rows.length < PAGE_SIZE) {
      return flows;
    }

    const lastRow = rows.at(-1);
    if (!lastRow) {
      return flows;
    }
    const nextCursor = { bucketStart: lastRow.bucketStart, id: lastRow.id };
    if (cursor?.bucketStart === nextCursor.bucketStart && cursor.id === nextCursor.id) {
      throw new Error('Position daily flow pagination did not advance');
    }
    cursor = nextCursor;
  }

  throw new Error(`Position daily flow history exceeded the safe pagination limit (${MAX_PAGES * PAGE_SIZE} rows)`);
}

export const fetchCompletedPositionDailyFlows = (options: Omit<Parameters<typeof fetchPositionDailyFlows>[0], 'includeCurrentBucket'>) =>
  fetchPositionDailyFlows(options);

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

export async function fetchCompletedPositionDailyFlows({
  userAddress,
  chainId,
  marketIds,
  startTimestamp,
  endTimestamp,
}: {
  userAddress: string;
  chainId: number;
  marketIds: string[];
  startTimestamp: number;
  endTimestamp: number;
}): Promise<PositionDailyFlow[]> {
  const startBucket = getDayStart(startTimestamp);
  // The current UTC bucket is mutable. Excluding it keeps every paged row
  // stable; the chart uses the live on-chain position for its final point.
  const endBucket = Math.min(getDayStart(endTimestamp), getDayStart(Math.floor(Date.now() / 1000)));
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

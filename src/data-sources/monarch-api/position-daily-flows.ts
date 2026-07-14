import { buildEnvioPositionDailyFlowsPageQuery } from '@/graphql/envio-queries';
import { monarchGraphqlFetcher } from './fetchers';

export type PositionDailyFlow = {
  id: string;
  marketId: string;
  bucketStart: number;
  lastActivityTimestamp: number;
  suppliedAssets: string;
  withdrawnAssets: string;
  netSupplyAssets: string;
  closingSupplyShares: string;
  supplyWeightedSharesSeconds: string;
  supplyActiveSeconds: number;
};

export type MarketDailySupplySnapshot = {
  id: string;
  marketId: string;
  bucketStart: number;
  totalSupplyAssets: string;
  totalSupplyShares: string;
};

export type PositionDailyAnalytics = {
  flows: PositionDailyFlow[];
  marketSnapshots: MarketDailySupplySnapshot[];
};

type PositionDailyFlowRow = Omit<PositionDailyFlow, 'bucketStart' | 'lastActivityTimestamp' | 'supplyActiveSeconds'> & {
  bucketStart: string;
  lastActivityTimestamp: string;
  supplyActiveSeconds: string;
};

type MarketDailySupplySnapshotRow = Omit<MarketDailySupplySnapshot, 'bucketStart'> & { bucketStart: string };

type PositionDailyFlowsResponse = {
  data?: {
    PositionDailyFlow?: PositionDailyFlowRow[];
    markets?: MarketDailySupplySnapshotRow[];
  };
};

type PositionDailyFlowsParams = {
  userAddress: string;
  chainId: number;
  marketIds: string[];
  startTimestamp: number;
  endTimestamp: number;
};

const SECONDS_PER_DAY = 86_400;
const PAGE_SIZE = 1_000;
const MAX_PAGES = 50;

const getDayStart = (timestamp: number): number => Math.floor(timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;

type Cursor = { bucketStart: string; id: string };

const getCursor = (row: { bucketStart: string; id: string } | undefined): Cursor | undefined =>
  row ? { bucketStart: row.bucketStart, id: row.id } : undefined;

const fetchPositionDailyFlowData = async (
  { userAddress, chainId, marketIds, startTimestamp, endTimestamp }: PositionDailyFlowsParams,
  includeMarketSnapshots: boolean,
): Promise<PositionDailyAnalytics> => {
  const startBucket = getDayStart(startTimestamp);
  // The current UTC bucket is mutable. Excluding it keeps every paged row stable.
  const endBucket = Math.min(getDayStart(endTimestamp), getDayStart(Math.floor(Date.now() / 1000)));
  const result: PositionDailyAnalytics = { flows: [], marketSnapshots: [] };
  if (marketIds.length === 0 || endBucket <= startBucket) return result;

  let flowCursor: Cursor | undefined;
  let marketCursor: Cursor | undefined;
  let flowsComplete = false;
  let marketsComplete = !includeMarketSnapshots;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response: PositionDailyFlowsResponse = await monarchGraphqlFetcher<PositionDailyFlowsResponse>(
      buildEnvioPositionDailyFlowsPageQuery({
        afterFlowCursor: Boolean(flowCursor),
        afterMarketCursor: Boolean(marketCursor),
        includeMarketSnapshots,
      }),
      {
        user: userAddress.toLowerCase(),
        chainId,
        marketIds: marketIds.map((marketId) => marketId.toLowerCase()),
        startBucket: String(startBucket),
        endBucket: String(endBucket),
        flowLimit: flowsComplete ? 0 : PAGE_SIZE,
        ...(includeMarketSnapshots
          ? { marketStartBucket: String(Math.max(0, startBucket - SECONDS_PER_DAY)), marketLimit: marketsComplete ? 0 : PAGE_SIZE }
          : {}),
        ...(flowCursor ? { flowCursorBucket: flowCursor.bucketStart, flowCursorId: flowCursor.id } : {}),
        ...(marketCursor ? { marketCursorBucket: marketCursor.bucketStart, marketCursorId: marketCursor.id } : {}),
      },
    );
    const flowRows: PositionDailyFlowRow[] = response.data?.PositionDailyFlow ?? [];
    const marketRows: MarketDailySupplySnapshotRow[] = response.data?.markets ?? [];

    for (const row of flowRows) {
      result.flows.push({
        ...row,
        bucketStart: Number(row.bucketStart),
        lastActivityTimestamp: Number(row.lastActivityTimestamp),
        supplyActiveSeconds: Number(row.supplyActiveSeconds),
      });
    }

    for (const row of marketRows) {
      result.marketSnapshots.push({ ...row, bucketStart: Number(row.bucketStart) });
    }

    flowsComplete ||= flowRows.length < PAGE_SIZE;
    marketsComplete ||= marketRows.length < PAGE_SIZE;
    if (flowsComplete && marketsComplete) return result;

    if (!flowsComplete) {
      const nextCursor = getCursor(flowRows.at(-1));
      if (!nextCursor || (nextCursor.bucketStart === flowCursor?.bucketStart && nextCursor.id === flowCursor.id)) {
        throw new Error('Position daily flow pagination did not advance');
      }
      flowCursor = nextCursor;
    }

    if (!marketsComplete) {
      const nextCursor = getCursor(marketRows.at(-1));
      if (!nextCursor || (nextCursor.bucketStart === marketCursor?.bucketStart && nextCursor.id === marketCursor.id)) {
        throw new Error('Market daily snapshot pagination did not advance');
      }
      marketCursor = nextCursor;
    }
  }

  throw new Error(`Position daily analytics exceeded the safe pagination limit (${MAX_PAGES * PAGE_SIZE} rows)`);
};

export const fetchCompletedPositionDailyFlows = async (params: PositionDailyFlowsParams): Promise<PositionDailyFlow[]> =>
  (await fetchPositionDailyFlowData(params, false)).flows;

export const fetchCompletedPositionDailyAnalytics = (params: PositionDailyFlowsParams): Promise<PositionDailyAnalytics> =>
  fetchPositionDailyFlowData(params, true);

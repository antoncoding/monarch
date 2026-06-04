import { envioMarketBorrowFlowEventsWindowQuery, envioMarketSupplyFlowEventsWindowQuery } from '@/graphql/envio-queries';
import { monarchGraphqlFetcher } from './fetchers';

const MONARCH_MARKET_FLOW_EVENTS_TIMEOUT_MS = 15_000;

export type MarketFlowKind = 'supply' | 'borrow';
export type MarketFlowDirection = 'positive' | 'negative';
type MarketFlowEventType = 'supply' | 'withdraw' | 'borrow' | 'repay';

export type MarketFlowEvent = {
  id: string;
  hash: string;
  timestamp: number;
  direction: MarketFlowDirection;
  amount: string;
  address: string;
};

export type PaginatedMarketFlowEvents = {
  items: MarketFlowEvent[];
  hasNextPage: boolean;
};

type MonarchGraphqlResponse<T> = {
  data?: T;
};

type MonarchFlowEventRow = {
  id: string;
  txHash: string;
  timestamp: string | number;
  assets: string;
  onBehalf: string;
};

type MonarchSupplyFlowEventsResponse = MonarchGraphqlResponse<{
  supplies: MonarchFlowEventRow[];
  withdraws: MonarchFlowEventRow[];
}>;

type MonarchBorrowFlowEventsResponse = MonarchGraphqlResponse<{
  borrows: MonarchFlowEventRow[];
  repays: MonarchFlowEventRow[];
}>;

type MonarchFlowEventsResponse = MonarchSupplyFlowEventsResponse | MonarchBorrowFlowEventsResponse;
type FlowEventsVariables = {
  chainId: number;
  marketId: string;
  startTimestamp: string;
  endTimestamp: string;
  limit: number;
  offset: number;
};

const toTimestamp = (value: string | number): number => (typeof value === 'number' ? value : Number.parseInt(value, 10));

const fetchFlowEventsResponse = async <T extends MonarchFlowEventsResponse>(query: string, variables: FlowEventsVariables): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MONARCH_MARKET_FLOW_EVENTS_TIMEOUT_MS);

  try {
    return await monarchGraphqlFetcher<T>(query, variables, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Monarch market flow events request timed out after ${MONARCH_MARKET_FLOW_EVENTS_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const mapFlowRows = (rows: MonarchFlowEventRow[], eventType: MarketFlowEventType, direction: MarketFlowDirection): MarketFlowEvent[] =>
  rows.map((row) => ({
    id: `${eventType}:${row.id}`,
    hash: row.txHash,
    timestamp: toTimestamp(row.timestamp),
    direction,
    amount: row.assets,
    address: row.onBehalf,
  }));

const sortFlowEvents = (left: MarketFlowEvent, right: MarketFlowEvent): number => {
  if (left.timestamp !== right.timestamp) {
    return right.timestamp - left.timestamp;
  }

  const hashOrder = right.hash.localeCompare(left.hash);
  if (hashOrder !== 0) {
    return hashOrder;
  }

  return right.id.localeCompare(left.id);
};

const fetchSupplyFlowEvents = async (
  marketId: string,
  chainId: number,
  startTimestamp: number,
  endTimestamp: number,
  limit: number,
  offset: number,
) => {
  const response = await fetchFlowEventsResponse<MonarchSupplyFlowEventsResponse>(envioMarketSupplyFlowEventsWindowQuery, {
    chainId,
    marketId,
    startTimestamp: startTimestamp.toString(),
    endTimestamp: endTimestamp.toString(),
    limit,
    offset,
  });

  return {
    positiveRows: response.data?.supplies ?? [],
    negativeRows: response.data?.withdraws ?? [],
  };
};

const fetchBorrowFlowEvents = async (
  marketId: string,
  chainId: number,
  startTimestamp: number,
  endTimestamp: number,
  limit: number,
  offset: number,
) => {
  const response = await fetchFlowEventsResponse<MonarchBorrowFlowEventsResponse>(envioMarketBorrowFlowEventsWindowQuery, {
    chainId,
    marketId,
    startTimestamp: startTimestamp.toString(),
    endTimestamp: endTimestamp.toString(),
    limit,
    offset,
  });

  return {
    positiveRows: response.data?.borrows ?? [],
    negativeRows: response.data?.repays ?? [],
  };
};

export const fetchMonarchMarketFlowEventsInWindow = async (
  marketId: string,
  chainId: number,
  flowKind: MarketFlowKind,
  startTimestamp: number,
  endTimestamp: number,
  first = 500,
  skip = 0,
): Promise<PaginatedMarketFlowEvents> => {
  const rows =
    flowKind === 'supply'
      ? await fetchSupplyFlowEvents(marketId, chainId, startTimestamp, endTimestamp, first + 1, skip)
      : await fetchBorrowFlowEvents(marketId, chainId, startTimestamp, endTimestamp, first + 1, skip);
  const positiveRows = rows.positiveRows.slice(0, first);
  const negativeRows = rows.negativeRows.slice(0, first);
  const positiveEventType = flowKind === 'supply' ? 'supply' : 'borrow';
  const negativeEventType = flowKind === 'supply' ? 'withdraw' : 'repay';
  const items = [
    ...mapFlowRows(positiveRows, positiveEventType, 'positive'),
    ...mapFlowRows(negativeRows, negativeEventType, 'negative'),
  ].sort(sortFlowEvents);
  const hasNextPage = rows.positiveRows.length > first || rows.negativeRows.length > first;

  return {
    items,
    hasNextPage,
  };
};

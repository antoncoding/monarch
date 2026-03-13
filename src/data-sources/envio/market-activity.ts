import type { SupportedNetworks } from '@/utils/networks';
import type { MarketActivityTransaction, MarketLiquidationTransaction, PaginatedMarketActivityTransactions } from '@/utils/types';
import {
  fetchEnvioBorrowRows,
  fetchEnvioLiquidationRows,
  fetchEnvioRepayRows,
  fetchEnvioSupplyRows,
  fetchEnvioWithdrawRows,
} from './events';
import { normalizeEnvioString, normalizeEnvioTimestamp } from './utils';

const EVENT_FETCH_MINIMUM = '0';

const sortByTimestampDescending = <T extends { timestamp: number }>(items: T[]): T[] => {
  return items.sort((left, right) => right.timestamp - left.timestamp);
};

const buildMarketEventWhere = ({
  chainId,
  marketId,
  minAssets = EVENT_FETCH_MINIMUM,
}: {
  chainId: SupportedNetworks;
  marketId: string;
  minAssets?: string;
}) => ({
  assets: {
    _gte: minAssets,
  },
  chainId: {
    _eq: chainId,
  },
  market_id: {
    _eq: marketId.toLowerCase(),
  },
});

const mapSupplyActivity = (events: Awaited<ReturnType<typeof fetchEnvioSupplyRows>>): MarketActivityTransaction[] => {
  return events.map((event) => ({
    amount: normalizeEnvioString(event.assets),
    hash: event.txHash,
    timestamp: normalizeEnvioTimestamp(event.timestamp),
    type: 'MarketSupply',
    userAddress: event.onBehalf,
  }));
};

const mapWithdrawActivity = (events: Awaited<ReturnType<typeof fetchEnvioWithdrawRows>>): MarketActivityTransaction[] => {
  return events.map((event) => ({
    amount: normalizeEnvioString(event.assets),
    hash: event.txHash,
    timestamp: normalizeEnvioTimestamp(event.timestamp),
    type: 'MarketWithdraw',
    userAddress: event.onBehalf,
  }));
};

const mapBorrowActivity = (events: Awaited<ReturnType<typeof fetchEnvioBorrowRows>>): MarketActivityTransaction[] => {
  return events.map((event) => ({
    amount: normalizeEnvioString(event.assets),
    hash: event.txHash,
    timestamp: normalizeEnvioTimestamp(event.timestamp),
    type: 'MarketBorrow',
    userAddress: event.onBehalf,
  }));
};

const mapRepayActivity = (events: Awaited<ReturnType<typeof fetchEnvioRepayRows>>): MarketActivityTransaction[] => {
  return events.map((event) => ({
    amount: normalizeEnvioString(event.assets),
    hash: event.txHash,
    timestamp: normalizeEnvioTimestamp(event.timestamp),
    type: 'MarketRepay',
    userAddress: event.onBehalf,
  }));
};

export const fetchEnvioMarketSupplies = async (
  marketId: string,
  chainId: SupportedNetworks,
  minAssets = EVENT_FETCH_MINIMUM,
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const where = buildMarketEventWhere({
    chainId,
    marketId,
    minAssets,
  });

  const [supplyEvents, withdrawEvents] = await Promise.all([fetchEnvioSupplyRows(where), fetchEnvioWithdrawRows(where)]);
  const items = sortByTimestampDescending([...mapSupplyActivity(supplyEvents), ...mapWithdrawActivity(withdrawEvents)]);

  return {
    items: items.slice(skip, skip + first),
    totalCount: items.length,
  };
};

export const fetchEnvioMarketBorrows = async (
  marketId: string,
  chainId: SupportedNetworks,
  minAssets = EVENT_FETCH_MINIMUM,
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  const where = buildMarketEventWhere({
    chainId,
    marketId,
    minAssets,
  });

  const [borrowEvents, repayEvents] = await Promise.all([fetchEnvioBorrowRows(where), fetchEnvioRepayRows(where)]);
  const items = sortByTimestampDescending([...mapBorrowActivity(borrowEvents), ...mapRepayActivity(repayEvents)]);

  return {
    items: items.slice(skip, skip + first),
    totalCount: items.length,
  };
};

export const fetchEnvioMarketLiquidations = async (
  marketId: string,
  chainId: SupportedNetworks,
): Promise<MarketLiquidationTransaction[]> => {
  const liquidations = await fetchEnvioLiquidationRows({
    chainId: {
      _eq: chainId,
    },
    market_id: {
      _eq: marketId.toLowerCase(),
    },
  });

  return sortByTimestampDescending(
    liquidations.map((liquidation) => ({
      badDebtAssets: normalizeEnvioString(liquidation.badDebtAssets),
      hash: liquidation.txHash,
      liquidator: liquidation.caller,
      repaidAssets: normalizeEnvioString(liquidation.repaidAssets),
      seizedAssets: normalizeEnvioString(liquidation.seizedAssets),
      timestamp: normalizeEnvioTimestamp(liquidation.timestamp),
      type: 'MarketLiquidation' as const,
    })),
  );
};

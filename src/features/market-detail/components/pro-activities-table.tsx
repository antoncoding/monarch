'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import moment from 'moment';
import { type Address, formatUnits } from 'viem';
import { Info } from '@/components/Info/info';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { AccountIdentity } from '@/components/shared/account-identity';
import { TablePagination } from '@/components/shared/table-pagination';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { TokenIcon } from '@/components/shared/token-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExpandableRow } from '@/components/ui/data-table/ExpandableRow';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { type MarketProActivityKind, type MarketProActivityLeg } from '@/data-sources/monarch-api';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { useMarketTxContexts } from '@/hooks/useMarketTxContexts';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { formatSimple } from '@/utils/balance';
import type { Market } from '@/utils/types';

const PAGE_SIZE = 8;
const EXPANDED_ROW_COLSPAN = 6;

const activityKindMeta: Record<
  MarketProActivityKind,
  { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  directSupply: { label: 'Supply', variant: 'success' },
  directWithdraw: { label: 'Withdraw', variant: 'danger' },
  directBorrow: { label: 'Borrow', variant: 'danger' },
  directRepay: { label: 'Repay', variant: 'success' },
  vaultDeposit: { label: 'Vault Deposit', variant: 'primary' },
  vaultWithdraw: { label: 'Vault Withdraw', variant: 'warning' },
  vaultRebalance: { label: 'Rebalance', variant: 'default' },
  monarchTx: { label: 'Monarch', variant: 'primary' },
  others: { label: 'Others', variant: 'default' },
  batched: { label: 'Batched', variant: 'default' },
};

const legKindMeta: Record<
  MarketProActivityLeg['kind'],
  { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  supply: { label: 'Supply', variant: 'success' },
  withdraw: { label: 'Withdraw', variant: 'danger' },
  borrow: { label: 'Borrow', variant: 'danger' },
  repay: { label: 'Repay', variant: 'success' },
  supplyCollateral: { label: 'Supply Collateral', variant: 'primary' },
  withdrawCollateral: { label: 'Withdraw Collateral', variant: 'warning' },
  vaultDeposit: { label: 'Vault Deposit', variant: 'primary' },
  vaultWithdraw: { label: 'Vault Withdraw', variant: 'warning' },
  vaultAllocate: { label: 'Allocate', variant: 'default' },
  vaultDeallocate: { label: 'Deallocate', variant: 'default' },
  vaultForceDeallocate: { label: 'Force Deallocate', variant: 'danger' },
  legacyVaultReallocateSupply: { label: 'Supply', variant: 'success' },
  legacyVaultReallocateWithdraw: { label: 'Withdraw', variant: 'danger' },
};

type MarketFlowDirection = 'in' | 'out';

type MarketFlowEntry = {
  marketId: string;
  direction: MarketFlowDirection;
  amount: string;
  assetType: 'loan' | 'collateral';
};

const getAssetMetadata = (market: Market, assetType: 'loan' | 'collateral') => {
  return assetType === 'loan' ? market.loanAsset : market.collateralAsset;
};

const formatAmount = (amount: string, decimals: number): string => {
  return formatSimple(Number(formatUnits(BigInt(amount), decimals)));
};

const getMarketMapKey = (marketId: string): string => marketId.toLowerCase();
const isSameMarketId = (left: string, right: string): boolean => getMarketMapKey(left) === getMarketMapKey(right);
const sameAddress = (left: string | undefined, right: string | undefined): boolean =>
  left !== undefined && right !== undefined && left.toLowerCase() === right.toLowerCase();
const isRebalanceLikeKind = (kind: MarketProActivityKind): boolean => kind === 'vaultRebalance' || kind === 'monarchTx';

type ProActivitiesTableProps = {
  chainId: number;
  market: Market;
  onSwitchToBasic: () => void;
};

export function ProActivitiesTable({ chainId, market, onSwitchToBasic }: ProActivitiesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { allMarkets } = useProcessedMarkets();

  const { data, isLoading, isFetching, error, refetch } = useMarketTxContexts(market.uniqueKey, market.morphoBlue.chain.id, currentPage, PAGE_SIZE);

  const activities = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const marketMap = useMemo(() => {
    const nextMap = new Map<string, Market>();

    nextMap.set(getMarketMapKey(market.uniqueKey), market);
    for (const candidate of allMarkets) {
      if (candidate.morphoBlue.chain.id !== market.morphoBlue.chain.id) {
        continue;
      }

      nextMap.set(getMarketMapKey(candidate.uniqueKey), candidate);
    }

    return nextMap;
  }, [allMarkets, market]);

  const renderMarketReference = (marketId: string, key: string): ReactNode => {
    const referencedMarket = marketMap.get(getMarketMapKey(marketId));
    if (referencedMarket) {
      return (
        <MarketIdentity
          key={key}
          market={referencedMarket}
          chainId={chainId}
          mode={MarketIdentityMode.Badge}
          showLltv={false}
        />
      );
    }

    return (
      <MarketIdBadge
        key={key}
        marketId={marketId}
        chainId={chainId}
      />
    );
  };

  const renderCurrentMarketTag = (): ReactNode => {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-hovered px-2 py-1 text-xs whitespace-nowrap text-secondary">
        This Market
      </span>
    );
  };

  const getLegDirection = (leg: MarketProActivityLeg): MarketFlowDirection | null => {
    if (leg.kind === 'supply' || leg.kind === 'repay' || leg.kind === 'legacyVaultReallocateSupply') {
      return 'in';
    }

    if (leg.kind === 'withdraw' || leg.kind === 'borrow' || leg.kind === 'legacyVaultReallocateWithdraw') {
      return 'out';
    }

    return null;
  };

  const isMorphoMarketLoanFlowLeg = (leg: MarketProActivityLeg): boolean => {
    if (leg.source !== 'morpho' || leg.assetType !== 'loan') {
      return false;
    }

    return leg.kind === 'supply' || leg.kind === 'withdraw' || leg.kind === 'borrow' || leg.kind === 'repay';
  };

  const getMarketFlowEntries = (activity: (typeof activities)[number]): MarketFlowEntry[] => {
    const flowMap = new Map<string, { marketId: string; direction: MarketFlowDirection; amount: bigint; assetType: 'loan' | 'collateral' }>();

    for (const leg of activity.legs) {
      if (!leg.marketId || !isMorphoMarketLoanFlowLeg(leg)) {
        continue;
      }

      const direction = getLegDirection(leg);
      if (!direction) {
        continue;
      }

      const key = `${getMarketMapKey(leg.marketId)}:${direction}:${leg.assetType}`;
      const existing = flowMap.get(key);

      if (existing) {
        existing.amount += BigInt(leg.amount);
        continue;
      }

      flowMap.set(key, {
        marketId: leg.marketId,
        direction,
        amount: BigInt(leg.amount),
        assetType: leg.assetType,
      });
    }

    return [...flowMap.values()]
      .map((entry) => ({
        marketId: entry.marketId,
        direction: entry.direction,
        amount: entry.amount.toString(),
        assetType: entry.assetType,
      }))
      .sort((left, right) => {
        if (left.direction !== right.direction) {
          return left.direction === 'out' ? -1 : 1;
        }

        const leftAmount = BigInt(left.amount);
        const rightAmount = BigInt(right.amount);

        if (rightAmount === leftAmount) {
          return 0;
        }

        return rightAmount > leftAmount ? 1 : -1;
      });
  };

  const formatFlowAmount = (entry: MarketFlowEntry): string => {
    const entryMarket = marketMap.get(getMarketMapKey(entry.marketId)) ?? market;
    const asset = getAssetMetadata(entryMarket, entry.assetType);
    return `${formatAmount(entry.amount, asset.decimals)} ${asset.symbol}`;
  };

  const getLegAsset = (leg: MarketProActivityLeg) => {
    const legMarket = leg.marketId ? (marketMap.get(getMarketMapKey(leg.marketId)) ?? market) : market;
    return getAssetMetadata(legMarket, leg.assetType);
  };

  const getRowLoanFlows = (activity: (typeof activities)[number]) => {
    let inflow = 0n;
    let outflow = 0n;

    for (const leg of activity.legs) {
      if (!leg.isCurrentMarket || !isMorphoMarketLoanFlowLeg(leg)) {
        continue;
      }

      const direction = getLegDirection(leg);
      if (direction === 'in') {
        inflow += BigInt(leg.amount);
      } else if (direction === 'out') {
        outflow += BigInt(leg.amount);
      }
    }

    const flows: Array<{ direction: MarketFlowDirection; amount: string }> = [];
    if (inflow > 0n) {
      flows.push({ direction: 'in', amount: inflow.toString() });
    }
    if (outflow > 0n) {
      flows.push({ direction: 'out', amount: outflow.toString() });
    }

    return flows;
  };

  const getSupportingVaultLeg = (
    activity: (typeof activities)[number],
    leg: MarketProActivityLeg,
  ): MarketProActivityLeg | undefined => {
    const supportingKind = leg.kind === 'supply' ? 'vaultDeposit' : leg.kind === 'withdraw' ? 'vaultWithdraw' : null;
    if (!supportingKind) {
      return undefined;
    }

    const candidates = activity.legs.filter((candidate) => candidate.kind === supportingKind && candidate.vaultAddress);
    if (candidates.length === 0) {
      return undefined;
    }

    return (
      candidates.find((candidate) => {
        return (
          sameAddress(candidate.vaultAddress, leg.positionAddress) ||
          sameAddress(candidate.vaultAddress, leg.vaultAddress) ||
          sameAddress(candidate.vaultAddress, activity.vaultAddress)
        );
      }) ?? candidates[0]
    );
  };

  const getProcessedEventActorAddress = (
    activity: (typeof activities)[number],
    leg: MarketProActivityLeg,
  ): Address | undefined => {
    const supportingVaultLeg = getSupportingVaultLeg(activity, leg);
    if (supportingVaultLeg) {
      const vaultActor =
        leg.kind === 'withdraw'
          ? supportingVaultLeg.positionAddress ?? supportingVaultLeg.receiverAddress ?? supportingVaultLeg.actorAddress
          : supportingVaultLeg.positionAddress ?? supportingVaultLeg.actorAddress;

      return vaultActor as Address | undefined;
    }

    return (leg.positionAddress ?? leg.receiverAddress ?? leg.actorAddress) as Address | undefined;
  };

  const getProcessedEventIntermediaryAddress = (
    activity: (typeof activities)[number],
    leg: MarketProActivityLeg,
  ): Address | undefined => {
    const actorAddress = getProcessedEventActorAddress(activity, leg);
    const supportingVaultLeg = getSupportingVaultLeg(activity, leg);
    const intermediaryAddress = supportingVaultLeg?.vaultAddress ?? leg.vaultAddress;

    if (!intermediaryAddress || sameAddress(intermediaryAddress, actorAddress)) {
      return undefined;
    }

    return intermediaryAddress as Address;
  };

  const hasMatchingLegacyReallocateLeg = (
    eventLegs: MarketProActivityLeg[],
    leg: MarketProActivityLeg,
  ): boolean => {
    if (leg.kind !== 'supply' && leg.kind !== 'withdraw') {
      return false;
    }

    const matchingKind = leg.kind === 'supply' ? 'legacyVaultReallocateSupply' : 'legacyVaultReallocateWithdraw';

    return eventLegs.some((candidate) => {
      return (
        candidate.kind === matchingKind &&
        candidate.marketId !== undefined &&
        leg.marketId !== undefined &&
        isSameMarketId(candidate.marketId, leg.marketId) &&
        candidate.amount === leg.amount &&
        sameAddress(candidate.vaultAddress, leg.positionAddress)
      );
    });
  };

  const getProcessedEventLegs = (activity: (typeof activities)[number]): MarketProActivityLeg[] => {
    const currentMarketLegs = activity.legs.filter((leg) => leg.isCurrentMarket);
    const eventLegs = currentMarketLegs.length > 0 ? currentMarketLegs : activity.legs;

    return eventLegs.filter((leg) => {
      return !hasMatchingLegacyReallocateLeg(eventLegs, leg);
    });
  };

  const renderProcessedEventMarket = (leg: MarketProActivityLeg, key: string): ReactNode => {
    if (!leg.marketId) {
      return null;
    }

    if (leg.isCurrentMarket) {
      return (
        <Fragment key={key}>
          {renderCurrentMarketTag()}
        </Fragment>
      );
    }

    return (
      <MarketIdBadge
        key={key}
        marketId={leg.marketId}
        chainId={chainId}
      />
    );
  };

  const getLegAmountClassName = (leg: MarketProActivityLeg): string => {
    const direction = getLegDirection(leg);

    if (direction === 'in') {
      return 'text-green-600 dark:text-green-400';
    }

    if (direction === 'out') {
      return 'text-red-600 dark:text-red-400';
    }

    if (leg.kind === 'supplyCollateral') {
      return 'text-green-600 dark:text-green-400';
    }

    if (leg.kind === 'withdrawCollateral') {
      return 'text-red-600 dark:text-red-400';
    }

    return 'text-secondary';
  };

  const renderFlowMarketLabel = (entry: MarketFlowEntry, key: string): ReactNode => {
    const marketReference = renderMarketReference(entry.marketId, key);

    if (!isSameMarketId(entry.marketId, market.uniqueKey)) {
      return marketReference;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {marketReference}
        {renderCurrentMarketTag()}
      </div>
    );
  };

  const renderProcessedEvents = (activity: (typeof activities)[number]): ReactNode => {
    const eventLegs = getProcessedEventLegs(activity);

    return (
      <div className="space-y-3">
        <p className="font-monospace text-xs uppercase text-secondary">Processed Events</p>
        <div className="space-y-2">
          {eventLegs.map((leg) => {
            const legMeta = legKindMeta[leg.kind];
            const actorAddress = getProcessedEventActorAddress(activity, leg);
            const intermediaryAddress = getProcessedEventIntermediaryAddress(activity, leg);
            const asset = getLegAsset(leg);

            return (
              <div
                key={`processed-${activity.id}-${leg.id}`}
                className="flex items-center justify-between gap-3 rounded-sm bg-surface px-3 py-2"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {actorAddress ? (
                    <AccountIdentity
                      address={actorAddress}
                      chainId={chainId}
                      variant="badge"
                      linkTo="profile"
                      showActions={false}
                    />
                  ) : null}
                  {intermediaryAddress ? (
                    <>
                      <span className="text-xs text-secondary">via</span>
                      <AccountIdentity
                        address={intermediaryAddress}
                        chainId={chainId}
                        variant="badge"
                        linkTo="profile"
                        showActions={false}
                      />
                    </>
                  ) : null}
                  <Badge variant={legMeta.variant}>{legMeta.label}</Badge>
                  {renderProcessedEventMarket(leg, `processed-${leg.id}`)}
                </div>
                <div className={`flex shrink-0 items-center gap-2 text-sm font-medium tabular-nums ${getLegAmountClassName(leg)}`}>
                  <span>{formatAmount(leg.amount, asset.decimals)}</span>
                  <TokenIcon
                    address={asset.address}
                    chainId={market.morphoBlue.chain.id}
                    symbol={asset.symbol}
                    width={16}
                    height={16}
                  />
                  <span className="text-secondary">{asset.symbol}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderExpandedFlows = (activity: (typeof activities)[number]): ReactNode => {
    const flowEntries = getMarketFlowEntries(activity);
    const outflows = flowEntries.filter((entry) => entry.direction === 'out');
    const inflows = flowEntries.filter((entry) => entry.direction === 'in');

    if (flowEntries.length === 0) {
      return renderProcessedEvents(activity);
    }

    const renderFlowList = (entries: MarketFlowEntry[], direction: MarketFlowDirection, prefix: string) => {
      if (entries.length === 0) {
        return <p className="text-sm text-secondary">-</p>;
      }

      return (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={`${prefix}-${entry.marketId}-${direction}-${entry.assetType}`}
              className="flex items-center justify-between gap-3 rounded-sm bg-surface px-3 py-2"
            >
              <div className="min-w-0">{renderFlowMarketLabel(entry, `${prefix}-${entry.marketId}`)}</div>
              <span className={`shrink-0 text-sm font-medium tabular-nums ${direction === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {direction === 'in' ? '+' : '-'}
                {formatFlowAmount(entry)}
              </span>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="font-monospace text-xs uppercase text-secondary">From</p>
            {renderFlowList(outflows, 'out', `out-${activity.id}`)}
          </div>
          <div className="space-y-2">
            <p className="font-monospace text-xs uppercase text-secondary">To</p>
            {renderFlowList(inflows, 'in', `in-${activity.id}`)}
          </div>
        </div>
        {activity.currentMarketLegCount > 1 && renderProcessedEvents(activity)}
      </div>
    );
  };

  const getIntermediaryAddress = (activity: (typeof activities)[number]): Address | undefined => {
    if (activity.kind === 'monarchTx' || !activity.vaultAddress) {
      const fallbackVaultAddress = activity.legs.find((leg) => leg.vaultAddress)?.vaultAddress;
      return fallbackVaultAddress && activity.kind !== 'monarchTx' ? (fallbackVaultAddress as Address) : undefined;
    }

    return activity.vaultAddress as Address;
  };

  const renderRowFlow = (activity: (typeof activities)[number]): ReactNode => {
    const rowLoanFlows = getRowLoanFlows(activity);
    if (rowLoanFlows.length === 0) {
      return <span className="text-secondary">-</span>;
    }

    const renderFlowAmount = (flow: { direction: MarketFlowDirection; amount: string }) => {
      const amountClassName = flow.direction === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

      return (
        <div
          key={`${activity.id}-${flow.direction}`}
          className={`flex items-center justify-end gap-1.5 ${amountClassName}`}
        >
          <span className="font-medium tabular-nums">
            {flow.direction === 'in' ? '+' : '-'}
            {formatAmount(flow.amount, market.loanAsset.decimals)}
          </span>
          <TokenIcon
            address={market.loanAsset.address}
            chainId={market.morphoBlue.chain.id}
            symbol={market.loanAsset.symbol}
            width={16}
            height={16}
          />
        </div>
      );
    };

    if (activity.kind === 'batched' && rowLoanFlows.length > 1) {
      const inflow = rowLoanFlows.find((flow) => flow.direction === 'in');
      const outflow = rowLoanFlows.find((flow) => flow.direction === 'out');

      if (inflow && outflow) {
        const inflowAmount = BigInt(inflow.amount);
        const outflowAmount = BigInt(outflow.amount);
        const netAmount = inflowAmount - outflowAmount;

        if (netAmount === 0n) {
          const volumeAmount = inflowAmount >= outflowAmount ? inflowAmount : outflowAmount;

          return (
            <div className="flex items-center justify-end gap-1.5 text-secondary">
              <span className="font-medium tabular-nums">{formatAmount(volumeAmount.toString(), market.loanAsset.decimals)}</span>
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={16}
                height={16}
              />
            </div>
          );
        }

        return renderFlowAmount({
          direction: netAmount > 0n ? 'in' : 'out',
          amount: (netAmount > 0n ? netAmount : -netAmount).toString(),
        });
      }
    }

    return renderFlowAmount(rowLoanFlows[0]);
  };

  const headerActions = (
    <Tooltip
      content={
        <TooltipContent
          title="Refresh"
          detail="Fetch the latest Monarch transaction context data"
        />
      }
    >
      <span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-w-0 px-2 text-secondary"
        >
          <RefetchIcon isLoading={isFetching} />
        </Button>
      </span>
    </Tooltip>
  );

  const toggleRow = (rowId: string) => {
    setExpandedRows((previous) => {
      const next = new Set(previous);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Monarch error';

    return (
      <TableContainerWithHeader
        title="Market Activities"
        actions={headerActions}
      >
        <div className="space-y-4 p-6">
          <Info
            level="warning"
            title="Pro view unavailable"
            description={`Monarch transaction context metadata could not be loaded, so advanced activity is disabled right now. ${errorMessage}`}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="surface"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onSwitchToBasic}
            >
              Switch to Basic
            </Button>
          </div>
        </div>
      </TableContainerWithHeader>
    );
  }

  return (
    <div>
      <TableContainerWithHeader
        title="Market Activities"
        actions={headerActions}
      >
        <div className="relative">
          {isFetching && !isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-surface/80 backdrop-blur-sm">
              <Spinner size={24} />
            </div>
          )}

          <Table
            aria-label="Advanced market activity"
            className="responsive w-full min-w-[1080px] table-fixed"
          >
            <TableHeader>
              <TableRow className="text-secondary">
                <TableHead className="w-[20%] px-4 py-3 text-left">ACCOUNT</TableHead>
                <TableHead className="w-[16%] px-4 py-3 text-left">ACTION</TableHead>
                <TableHead className="w-[18%] px-4 py-3 text-left">INTERMEDIARY</TableHead>
                <TableHead className="w-[22%] px-4 py-3 text-right">FLOW</TableHead>
                <TableHead className="w-[12%] px-4 py-3 text-left">TIME</TableHead>
                <TableHead className="w-[12%] px-4 py-3 text-right">TRANSACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact text-sm">
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={EXPANDED_ROW_COLSPAN}
                    className="px-4 py-10"
                  >
                    <div className="flex items-center justify-center gap-2 text-secondary">
                      <Spinner size={20} />
                      <span>Loading pro activity</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : activities.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={EXPANDED_ROW_COLSPAN}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No pro activities found for this market
                  </TableCell>
                </TableRow>
              ) : (
                activities.map((activity) => {
                  const activityMeta = activityKindMeta[activity.kind];
                  const detailRowId = `${activity.id}-detail`;
                  const isExpanded = expandedRows.has(activity.id);
                  const intermediaryAddress = getIntermediaryAddress(activity);

                  return (
                    <Fragment key={activity.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50"
                        tabIndex={0}
                        aria-controls={detailRowId}
                        aria-expanded={isExpanded}
                        onClick={() => toggleRow(activity.id)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) {
                            return;
                          }

                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleRow(activity.id);
                          }
                        }}
                      >
                        <TableCell className="px-4 py-3">
                          {!activity.isMonarch && activity.actorAddress ? (
                            <AccountIdentity
                              address={activity.actorAddress as Address}
                              chainId={chainId}
                              variant="compact"
                              linkTo="profile"
                            />
                          ) : (
                            <span className="text-secondary">-</span>
                          )}
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          <Badge
                            variant={activityMeta.variant}
                            className="whitespace-nowrap"
                          >
                            {activityMeta.label}
                          </Badge>
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          {intermediaryAddress ? (
                            <AccountIdentity
                              address={intermediaryAddress}
                              chainId={chainId}
                              variant="compact"
                              linkTo="profile"
                              showActions={false}
                            />
                          ) : null}
                        </TableCell>

                        <TableCell className="px-4 py-3 text-right">
                          {renderRowFlow(activity)}
                        </TableCell>

                        <TableCell className="px-4 py-3 text-sm text-gray-500">{moment.unix(activity.timestamp).fromNow()}</TableCell>

                        <TableCell
                          className="px-4 py-3 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <TransactionIdentity
                            txHash={activity.hash}
                            chainId={market.morphoBlue.chain.id}
                          />
                        </TableCell>
                      </TableRow>

                      <ExpandableRow
                        isExpanded={isExpanded}
                        colSpan={EXPANDED_ROW_COLSPAN}
                      >
                        <div
                          id={detailRowId}
                          className="px-1"
                        >
                          {isRebalanceLikeKind(activity.kind) ? renderExpandedFlows(activity) : renderProcessedEvents(activity)}
                        </div>
                      </ExpandableRow>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </TableContainerWithHeader>

      {totalCount > 0 && (
        <TablePagination
          mode="open"
          hasNextPage={data?.hasNextPage ?? false}
          currentPage={currentPage}
          totalEntries={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          isLoading={isFetching}
          showEntryCount={false}
        />
      )}
    </div>
  );
}

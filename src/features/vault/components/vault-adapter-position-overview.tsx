'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { PulseLoader } from 'react-spinners';
import type { Address } from 'viem';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { UserPositionsChart } from '@/features/positions/components/user-positions-chart';
import { AllocationCell } from '@/features/positions/components/allocation-cell';
import { PositionPeriodSelector } from '@/features/position-detail/components/position-period-selector';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import type { MarketAllocation } from '@/types/vaultAllocations';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { PositionSnapshot } from '@/utils/positions';
import type { GroupedPosition, MarketPositionWithEarnings, UserTransaction } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';
import { calculateAllocationPercent, formatVaultAbsoluteCap, parseRelativeCap } from '@/utils/vaultAllocation';

const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  day: '24h',
  week: '7d',
  month: '30d',
  sixmonth: '6mo',
  all: 'All time',
};

type VaultAdapterPositionOverviewProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  adapterAddress: Address;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: EarningsPeriod;
  setPeriod: (period: EarningsPeriod) => void;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  marketAllocations: MarketAllocation[];
  totalAssets?: bigint;
};

type VaultMarketBreakdownTableProps = {
  markets: MarketPositionWithEarnings[];
  chainId: SupportedNetworks;
  detailHref: string;
  isEarningsLoading: boolean;
  periodLabel: string;
  marketAllocations: MarketAllocation[];
  totalAssets?: bigint;
};

function VaultMarketBreakdownTable({
  markets,
  chainId,
  detailHref,
  isEarningsLoading,
  periodLabel,
  marketAllocations,
  totalAssets,
}: VaultMarketBreakdownTableProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const allocationByMarket = useMemo(() => {
    const nextMap = new Map<string, MarketAllocation>();

    for (const allocation of marketAllocations) {
      nextMap.set(allocation.market.uniqueKey.toLowerCase(), allocation);
      nextMap.set(allocation.marketId.toLowerCase(), allocation);
    }

    return nextMap;
  }, [marketAllocations]);

  const sortedMarkets = useMemo(() => {
    return [...markets].sort((a, b) => {
      const aSupply = BigInt(a.state.supplyAssets);
      const bSupply = BigInt(b.state.supplyAssets);
      return bSupply > aSupply ? 1 : bSupply < aSupply ? -1 : 0;
    });
  }, [markets]);

  const totalAllocation = useMemo(() => {
    if (totalAssets !== undefined) return totalAssets;
    return marketAllocations.reduce((sum, allocation) => sum + allocation.allocation, 0n);
  }, [marketAllocations, totalAssets]);

  const actions = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="min-w-0 px-2 text-secondary hover:text-primary"
    >
      <Link href={detailHref}>
        Details
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );

  return (
    <TableContainerWithHeader
      title="Market Breakdown"
      actions={actions}
    >
      <Table>
        <TableHeader>
          <TableRow className="text-xs text-secondary">
            <TableHead className="px-4 py-3 text-left font-normal">Market</TableHead>
            <TableHead className="px-4 py-3 text-right font-normal">Allocation</TableHead>
            <TableHead className="px-4 py-3 text-right font-normal">Current Supply</TableHead>
            <TableHead className="px-4 py-3 text-right font-normal">
              <Tooltip
                content={
                  <TooltipContent
                    title={`Realized ${rateLabel} (${periodLabel})`}
                    detail="Annualized yield from interest earned over the selected period, weighted by balance over time."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                  Realized {rateLabel} ({periodLabel})
                </span>
              </Tooltip>
            </TableHead>
            <TableHead className="px-4 py-3 text-right font-normal">
              <Tooltip
                content={
                  <TooltipContent
                    title={`Interest Earned (${periodLabel})`}
                    detail="Interest accrued by this market over the selected period."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                  Earned ({periodLabel})
                </span>
              </Tooltip>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-sm">
          {sortedMarkets.map((position) => {
            const market = position.market;
            const allocation = allocationByMarket.get(market.uniqueKey.toLowerCase());
            const allocationAmount = allocation?.allocation ?? BigInt(position.state.supplyAssets);
            const allocationValue = formatBalance(allocationAmount, market.loanAsset.decimals);
            const allocationPercentage =
              totalAllocation > 0n ? Number.parseFloat(calculateAllocationPercent(allocationAmount, totalAllocation)) : 0;
            const relativeCap = allocation ? parseRelativeCap(allocation.relativeCap) : undefined;
            const capLabel = allocation
              ? `${relativeCap === undefined ? '-' : `${relativeCap.toFixed(2)}%`} / ${formatVaultAbsoluteCap(
                  allocation.absoluteCap,
                  market.loanAsset.decimals,
                  market.loanAsset.symbol,
                )}`
              : 'No configured cap';
            const currentSupply = formatBalance(BigInt(position.state.supplyAssets), market.loanAsset.decimals);
            const displayActualRate = isAprDisplay ? convertApyToApr(position.actualApy ?? 0) : position.actualApy ?? 0;
            const earned = position.earned ? BigInt(position.earned) : 0n;

            return (
              <TableRow
                key={`${chainId}:${market.uniqueKey}`}
                className="hover:bg-hovered"
              >
                <TableCell
                  className="px-4 py-3"
                  style={{ minWidth: '220px' }}
                >
                  <MarketIdentity
                    market={market}
                    chainId={chainId}
                    mode={MarketIdentityMode.Focused}
                    focus={MarketIdentityFocus.Collateral}
                    showId
                    showLltv
                    showOracle
                    iconSize={18}
                  />
                </TableCell>
                <TableCell
                  className="px-4 py-3"
                  style={{ minWidth: '150px' }}
                >
                  <AllocationCell
                    amount={allocationValue}
                    symbol={market.loanAsset.symbol}
                    percentage={allocationPercentage}
                    capPercentage={relativeCap}
                    capLabel={capLabel}
                    compact
                  />
                </TableCell>
                <TableCell
                  className="px-4 py-3 text-right"
                  style={{ minWidth: '130px' }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{formatReadable(currentSupply)}</span>
                    <TokenIcon
                      address={market.loanAsset.address}
                      chainId={chainId}
                      symbol={market.loanAsset.symbol}
                      width={16}
                      height={16}
                    />
                  </div>
                </TableCell>
                <TableCell
                  className="px-4 py-3 text-right"
                  style={{ minWidth: '130px' }}
                >
                  {isEarningsLoading ? (
                    <div className="flex justify-end">
                      <PulseLoader
                        size={4}
                        color="#f45f2d"
                        margin={3}
                      />
                    </div>
                  ) : displayActualRate === 0 ? (
                    <span className="text-secondary">-</span>
                  ) : (
                    <span>{(displayActualRate * 100).toFixed(2)}%</span>
                  )}
                </TableCell>
                <TableCell
                  className="px-4 py-3 text-right"
                  style={{ minWidth: '120px' }}
                >
                  {isEarningsLoading ? (
                    <div className="flex justify-end">
                      <PulseLoader
                        size={4}
                        color="#f45f2d"
                        margin={3}
                      />
                    </div>
                  ) : earned === 0n ? (
                    <span className="text-secondary">-</span>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5">
                      <span>
                        <span className="font-inter">+</span>
                        {formatReadable(formatBalance(earned, market.loanAsset.decimals))}
                      </span>
                      <TokenIcon
                        address={market.loanAsset.address}
                        chainId={chainId}
                        symbol={market.loanAsset.symbol}
                        width={14}
                        height={14}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainerWithHeader>
  );
}

export function VaultAdapterPositionOverview({
  groupedPosition,
  chainId,
  adapterAddress,
  isEarningsLoading,
  actualBlockData,
  period,
  setPeriod,
  transactions,
  snapshotsByChain,
  marketAllocations,
  totalAssets,
}: VaultAdapterPositionOverviewProps) {
  const periodLabel = PERIOD_LABELS[period];
  const detailHref = `/position/${chainId}/${groupedPosition.loanAssetAddress}/${adapterAddress}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs uppercase tracking-wider text-secondary">Period</span>
        <PositionPeriodSelector
          period={period}
          onPeriodChange={setPeriod}
          className="h-8 w-[110px] text-xs"
          contentClassName="z-[3600]"
        />
      </div>
      <UserPositionsChart
        variant="grouped"
        groupedPosition={groupedPosition}
        transactions={transactions}
        snapshotsByChain={snapshotsByChain}
        chainBlockData={actualBlockData}
        height={220}
      />
      <VaultMarketBreakdownTable
        markets={groupedPosition.markets}
        chainId={chainId}
        detailHref={detailHref}
        isEarningsLoading={isEarningsLoading}
        periodLabel={periodLabel}
        marketAllocations={marketAllocations}
        totalAssets={totalAssets}
      />
    </div>
  );
}

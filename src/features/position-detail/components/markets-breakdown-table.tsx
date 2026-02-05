'use client';

import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { PulseLoader } from 'react-spinners';
import moment from 'moment';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Button } from '@/components/ui/button';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketActionsCell } from './market-actions-cell';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable, formatBalance } from '@/utils/balance';
import type { MarketPositionWithEarnings } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

export type MarketsBreakdownTableProps = {
  markets: MarketPositionWithEarnings[];
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  periodLabel: string;
  isOwner: boolean;
  onRefetch: () => void;
  isRefetching: boolean;
};

type MarketRowProps = {
  position: MarketPositionWithEarnings;
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  periodLabel: string;
  rateLabel: string;
  isAprDisplay: boolean;
  isOwner: boolean;
  totalWeightedCapital: bigint;
};

function MarketRow({
  position,
  chainId,
  isEarningsLoading,
  actualBlockData,
  periodLabel,
  rateLabel,
  isAprDisplay,
  isOwner,
  totalWeightedCapital,
}: MarketRowProps) {
  const market = position.market;
  const loanDecimals = market.loanAsset.decimals;
  const supplyAmount = Number(formatUnits(BigInt(position.state.supplyAssets), loanDecimals));
  const earned = position.earned ? BigInt(position.earned) : 0n;
  const totalDeposits = position.totalDeposits ? BigInt(position.totalDeposits) : 0n;
  const totalWithdraws = position.totalWithdraws ? BigInt(position.totalWithdraws) : 0n;
  const avgCapital = position.avgCapital ? BigInt(position.avgCapital) : 0n;
  const weightedCapital = avgCapital > 0n && position.effectiveTime > 0 ? avgCapital * BigInt(position.effectiveTime) : 0n;
  const weightBps = totalWeightedCapital > 0n ? (weightedCapital * 10_000n) / totalWeightedCapital : 0n;
  const weightPct = Number(weightBps) / 100;

  // Actual APY from earnings calculation
  const actualApy = position.actualApy ?? 0;
  const displayActualRate = isAprDisplay ? convertApyToApr(actualApy) : actualApy;

  const formatTokenAmount = (value: bigint) => formatReadable(Number(formatBalance(value, loanDecimals)));

  const flowDisplay = (() => {
    if (isEarningsLoading) {
      return (
        <div className="flex justify-end">
          <PulseLoader
            size={4}
            color="#f45f2d"
            margin={3}
          />
        </div>
      );
    }

    if (totalDeposits === 0n && totalWithdraws === 0n) {
      return <span className="text-secondary">-</span>;
    }

    const netFlow = totalDeposits - totalWithdraws;
    const netAbs = netFlow < 0n ? -netFlow : netFlow;
    const netValue = formatTokenAmount(netAbs);
    const netClass = netFlow > 0n ? 'text-green-500' : netFlow < 0n ? 'text-red-500' : 'text-secondary';

    return (
      <Tooltip
        content={
          <TooltipContent
            title={`Net Flow (${periodLabel})`}
            detail={
              <div className="space-y-1">
                <div>
                  Deposits: <span className="font-inter">+</span>
                  {formatTokenAmount(totalDeposits)}
                </div>
                <div>
                  Withdrawals: <span className="font-inter">-</span>
                  {formatTokenAmount(totalWithdraws)}
                </div>
                <div>
                  Net: <span className="font-inter">{netFlow >= 0n ? '+' : '-'}</span>
                  {formatTokenAmount(netAbs)}
                </div>
              </div>
            }
          />
        }
      >
        <span className={`tabular-nums cursor-help ${netClass}`}>{netValue}</span>
      </Tooltip>
    );
  })();

  const weightDisplay = (() => {
    if (isEarningsLoading) {
      return (
        <div className="flex justify-end">
          <PulseLoader
            size={4}
            color="#f45f2d"
            margin={3}
          />
        </div>
      );
    }

    if (weightPct === 0) {
      return <span className="text-secondary">-</span>;
    }

    if (weightPct < 0.01) {
      return <span className="tabular-nums">&lt;0.01%</span>;
    }

    return <span className="tabular-nums">{weightPct.toFixed(2)}%</span>;
  })();

  return (
    <TableRow className="hover:bg-hovered">
      {/* Market */}
      <TableCell
        className="px-4 py-3"
        style={{ minWidth: '200px' }}
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

      {/* Supply Amount */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '120px' }}
      >
        <div className="flex items-center justify-end gap-1.5">
          <span>{formatReadable(supplyAmount)}</span>
          <TokenIcon
            address={market.loanAsset.address}
            chainId={chainId}
            symbol={market.loanAsset.symbol}
            width={16}
            height={16}
          />
        </div>
      </TableCell>

      {/* Actual APY (from earnings) */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '90px' }}
      >
        {isEarningsLoading ? (
          <div className="flex justify-end">
            <PulseLoader
              size={4}
              color="#f45f2d"
              margin={3}
            />
          </div>
        ) : actualApy === 0 ? (
          <span className="text-secondary">-</span>
        ) : (
          <span>{(displayActualRate * 100).toFixed(2)}%</span>
        )}
      </TableCell>

      {/* Interest Earned */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '110px' }}
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
              {formatReadable(Number(formatBalance(earned, loanDecimals)))}
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

      {/* Net Flow */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '140px' }}
      >
        {flowDisplay}
      </TableCell>

      {/* Time-weighted share */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '120px' }}
      >
        {weightDisplay}
      </TableCell>

      {/* Actions */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '180px' }}
      >
        <MarketActionsCell
          position={position}
          isOwner={isOwner}
        />
      </TableCell>
    </TableRow>
  );
}

export function MarketsBreakdownTable({
  markets,
  chainId,
  isEarningsLoading,
  actualBlockData,
  periodLabel,
  isOwner,
  onRefetch,
  isRefetching,
}: MarketsBreakdownTableProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const sortedMarkets = useMemo(() => {
    return [...markets].sort((a, b) => {
      const aSupply = BigInt(a.state.supplyAssets);
      const bSupply = BigInt(b.state.supplyAssets);
      return bSupply > aSupply ? 1 : bSupply < aSupply ? -1 : 0;
    });
  }, [markets]);

  const totalWeightedCapital = useMemo(() => {
    return sortedMarkets.reduce((total, position) => {
      const avgCapital = position.avgCapital ? BigInt(position.avgCapital) : 0n;
      if (avgCapital === 0n || position.effectiveTime <= 0) return total;
      return total + avgCapital * BigInt(position.effectiveTime);
    }, 0n);
  }, [sortedMarkets]);

  const headerActions = (
    <>
      <Tooltip
        content={
          <TooltipContent
            title="Refresh"
            detail="Fetch latest position data"
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefetch}
          disabled={isRefetching}
          className="text-secondary min-w-0 px-2"
        >
          <RefetchIcon isLoading={isRefetching} />
        </Button>
      </Tooltip>
    </>
  );

  return (
    <>
      <TableContainerWithHeader
        title="Markets Breakdown"
        actions={headerActions}
      >
      <Table>
        <TableHeader>
          <TableRow className="text-secondary">
            <TableHead
              className="px-4 py-3 text-left"
              style={{ minWidth: '200px' }}
            >
              Market
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '120px' }}
            >
              Supply
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '90px' }}
            >
              <Tooltip
                content={
                  <TooltipContent
                    title={`Realized ${rateLabel} (${periodLabel})`}
                    detail="Annualized yield from interest earned over the period, weighted by your balance over time."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                  Realized {rateLabel} ({periodLabel})
                </span>
              </Tooltip>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '110px' }}
            >
              <Tooltip
                content={(() => {
                  const blockData = actualBlockData[chainId];
                  if (!blockData) return 'Loading timestamp data...';

                  const startTimestamp = blockData.timestamp * 1000;
                  const endTimestamp = Date.now();

                  return (
                    <TooltipContent
                      title={`Interest Earned (${periodLabel})`}
                      detail={`From ${moment(startTimestamp).format('MMM D, YYYY HH:mm')} to ${moment(endTimestamp).format('MMM D, YYYY HH:mm')}`}
                    />
                  );
                })()}
              >
                <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                  Earned ({periodLabel})
                </span>
              </Tooltip>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '140px' }}
            >
              <Tooltip
                content={
                  <TooltipContent
                    title={`Net Flow (${periodLabel})`}
                    detail="Net change in your position over the period. Hover values for deposits and withdrawals."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                  Net Flow ({periodLabel})
                </span>
              </Tooltip>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '120px' }}
            >
              <Tooltip
                content={
                  <TooltipContent
                    title={`Time-weighted share (${periodLabel})`}
                    detail="Share of your balance weighted by time in this market over the period."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                  Time-weighted ({periodLabel})
                </span>
              </Tooltip>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '180px' }}
            >
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-sm">
          {sortedMarkets.map((position) => (
            <MarketRow
              key={position.market.uniqueKey}
              position={position}
              chainId={chainId}
              isEarningsLoading={isEarningsLoading}
              actualBlockData={actualBlockData}
              periodLabel={periodLabel}
              rateLabel={rateLabel}
              isAprDisplay={isAprDisplay}
              isOwner={isOwner}
              totalWeightedCapital={totalWeightedCapital}
            />
          ))}
        </TableBody>
      </Table>
      </TableContainerWithHeader>
    </>
  );
}

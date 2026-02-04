'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { PulseLoader } from 'react-spinners';
import moment from 'moment';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { CollateralIconsDisplay } from '@/features/positions/components/collateral-icons-display';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable, formatBalance } from '@/utils/balance';
import { convertApyToApr } from '@/utils/rateMath';
import { getGroupedEarnings } from '@/utils/positions';
import type { GroupedPosition, MarketPositionWithEarnings } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type OverviewTabProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: 'day' | 'week' | 'month';
};

type MarketRowProps = {
  position: MarketPositionWithEarnings;
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: string;
  rateLabel: string;
  isAprDisplay: boolean;
};

function MarketRow({ position, chainId, isEarningsLoading, actualBlockData, period, rateLabel, isAprDisplay }: MarketRowProps) {
  const market = position.market;
  const loanDecimals = market.loanAsset.decimals;
  const supplyAmount = Number(formatUnits(BigInt(position.state.supplyAssets), loanDecimals));
  const supplyApy = market.state?.supplyApy ?? 0;
  const displayRate = isAprDisplay ? convertApyToApr(supplyApy) : supplyApy;
  const earned = position.earned ? BigInt(position.earned) : 0n;

  return (
    <TableRow className="hover:bg-hovered">
      {/* Market */}
      <TableCell style={{ minWidth: '220px' }}>
        <Link
          href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
          className="no-underline hover:no-underline"
        >
          <MarketIdentity
            market={market}
            chainId={chainId}
            mode={MarketIdentityMode.Focused}
            focus={MarketIdentityFocus.Collateral}
            showLltv
            showOracle={false}
            iconSize={18}
          />
        </Link>
      </TableCell>

      {/* Supply Amount */}
      <TableCell
        className="text-right"
        style={{ minWidth: '130px' }}
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

      {/* APY */}
      <TableCell
        className="text-right"
        style={{ minWidth: '80px' }}
      >
        <span>{(displayRate * 100).toFixed(2)}%</span>
      </TableCell>

      {/* Interest Earned */}
      <TableCell
        className="text-right"
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
          <Tooltip
            content={(() => {
              const blockData = actualBlockData[chainId];
              if (!blockData) return 'Loading timestamp data...';

              const startTimestamp = blockData.timestamp * 1000;
              const endTimestamp = Date.now();

              return (
                <TooltipContent
                  title={`Interest Earned (${period})`}
                  detail={`From ${moment(startTimestamp).format('MMM D, YYYY HH:mm')} to ${moment(endTimestamp).format('MMM D, YYYY HH:mm')}`}
                />
              );
            })()}
          >
            <div className="flex items-center justify-end gap-1.5 cursor-help text-green-500">
              <span>+{formatReadable(Number(formatBalance(earned, loanDecimals)))}</span>
              <TokenIcon
                address={market.loanAsset.address}
                chainId={chainId}
                symbol={market.loanAsset.symbol}
                width={14}
                height={14}
              />
            </div>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}

export function OverviewTab({ groupedPosition, chainId, isEarningsLoading, actualBlockData, period }: OverviewTabProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const totalEarnings = useMemo(() => getGroupedEarnings(groupedPosition), [groupedPosition]);

  const periodLabels = {
    day: '24h',
    week: '7d',
    month: '30d',
  } as const;

  const sortedMarkets = useMemo(() => {
    return [...groupedPosition.markets].sort((a, b) => {
      const aSupply = BigInt(a.state.supplyAssets);
      const bSupply = BigInt(b.state.supplyAssets);
      return bSupply > aSupply ? 1 : bSupply < aSupply ? -1 : 0;
    });
  }, [groupedPosition.markets]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Total Supply Card */}
        <div className="bg-surface rounded border border-border p-4">
          <p className="text-xs uppercase tracking-wider text-secondary">Total Supply</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl tabular-nums">{formatReadable(groupedPosition.totalSupply)}</span>
            <TokenIcon
              address={groupedPosition.loanAssetAddress}
              chainId={chainId}
              symbol={groupedPosition.loanAssetSymbol}
              width={24}
              height={24}
            />
          </div>
        </div>

        {/* Average APY Card */}
        <div className="bg-surface rounded border border-border p-4">
          <p className="text-xs uppercase tracking-wider text-secondary">Avg {rateLabel}</p>
          <div className="mt-2">
            <span className="text-2xl tabular-nums">
              {formatReadable((isAprDisplay ? convertApyToApr(groupedPosition.totalWeightedApy) : groupedPosition.totalWeightedApy) * 100)}%
            </span>
          </div>
        </div>

        {/* Interest Earned Card */}
        <div className="bg-surface rounded border border-border p-4">
          <p className="text-xs uppercase tracking-wider text-secondary">Interest Earned ({periodLabels[period]})</p>
          <div className="mt-2 flex items-center gap-2">
            {isEarningsLoading ? (
              <PulseLoader
                size={6}
                color="#f45f2d"
                margin={3}
              />
            ) : totalEarnings === 0n ? (
              <span className="text-2xl text-secondary">-</span>
            ) : (
              <>
                <span className="text-2xl tabular-nums text-green-500">
                  +{formatReadable(Number(formatBalance(totalEarnings, groupedPosition.loanAssetDecimals)))}
                </span>
                <TokenIcon
                  address={groupedPosition.loanAssetAddress}
                  chainId={chainId}
                  symbol={groupedPosition.loanAssetSymbol}
                  width={24}
                  height={24}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Collateral Exposure */}
      {groupedPosition.collaterals.length > 0 && (
        <div className="bg-surface rounded border border-border p-4">
          <p className="text-xs uppercase tracking-wider text-secondary mb-3">Collateral Exposure</p>
          <CollateralIconsDisplay
            collaterals={groupedPosition.collaterals}
            chainId={chainId}
            maxDisplay={12}
            iconSize={28}
          />
        </div>
      )}

      {/* Markets Breakdown Table */}
      <TableContainerWithHeader title="Markets Breakdown">
        <Table>
          <TableHeader>
            <TableRow className="text-secondary">
              <TableHead
                className="text-left"
                style={{ minWidth: '220px' }}
              >
                Market
              </TableHead>
              <TableHead
                className="text-right"
                style={{ minWidth: '130px' }}
              >
                Supply
              </TableHead>
              <TableHead
                className="text-right"
                style={{ minWidth: '80px' }}
              >
                {rateLabel}
              </TableHead>
              <TableHead
                className="text-right"
                style={{ minWidth: '120px' }}
              >
                Earned ({periodLabels[period]})
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
                period={periodLabels[period]}
                rateLabel={rateLabel}
                isAprDisplay={isAprDisplay}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainerWithHeader>
    </div>
  );
}

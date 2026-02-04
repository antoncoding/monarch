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
import { MarketActionsCell } from './market-actions-cell';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable, formatBalance } from '@/utils/balance';
import { convertApyToApr } from '@/utils/rateMath';
import type { MarketPositionWithEarnings } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

export type MarketsBreakdownTableProps = {
  markets: MarketPositionWithEarnings[];
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  periodLabel: string;
  isOwner: boolean;
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
}: MarketRowProps) {
  const market = position.market;
  const loanDecimals = market.loanAsset.decimals;
  const supplyAmount = Number(formatUnits(BigInt(position.state.supplyAssets), loanDecimals));
  const supplyApy = market.state?.supplyApy ?? 0;
  const displayRate = isAprDisplay ? convertApyToApr(supplyApy) : supplyApy;
  const earned = position.earned ? BigInt(position.earned) : 0n;

  // Actual APY from earnings calculation
  const actualApy = position.actualApy ?? 0;
  const displayActualRate = isAprDisplay ? convertApyToApr(actualApy) : actualApy;

  return (
    <TableRow className="hover:bg-hovered">
      {/* Market */}
      <TableCell
        className="px-4 py-3"
        style={{ minWidth: '200px' }}
      >
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

      {/* Current APY */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '80px' }}
      >
        <Tooltip
          content={
            <TooltipContent
              title={`Current ${rateLabel}`}
              detail="Live rate from market state"
            />
          }
        >
          <span className="cursor-help">{(displayRate * 100).toFixed(2)}%</span>
        </Tooltip>
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
          <Tooltip
            content={
              <TooltipContent
                title={`Realized ${rateLabel} (${periodLabel})`}
                detail="Annualized yield derived from your actual interest earned"
              />
            }
          >
            <span className="cursor-help">{(displayActualRate * 100).toFixed(2)}%</span>
          </Tooltip>
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
            <div className="flex items-center justify-end gap-1.5 cursor-help">
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

      {/* Actions */}
      <TableCell
        className="px-4 py-3"
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

  return (
    <TableContainerWithHeader title="Markets Breakdown">
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
              style={{ minWidth: '80px' }}
            >
              {rateLabel}
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '90px' }}
            >
              {rateLabel} ({periodLabel})
            </TableHead>
            <TableHead
              className="px-4 py-3 text-right"
              style={{ minWidth: '110px' }}
            >
              Earned ({periodLabel})
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
            />
          ))}
        </TableBody>
      </Table>
    </TableContainerWithHeader>
  );
}

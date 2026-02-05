'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { PulseLoader } from 'react-spinners';
import moment from 'moment';
import { GearIcon } from '@radix-ui/react-icons';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FilterSection } from '@/components/ui/filter-components';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketActionsCell } from './market-actions-cell';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable, formatBalance } from '@/utils/balance';
import { convertApyToApr } from '@/utils/rateMath';
import { useDisclosure } from '@/hooks/useDisclosure';
import { PositionPeriodSelector } from './position-period-selector';
import type { MarketPositionWithEarnings } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

export type MarketsBreakdownTableProps = {
  markets: MarketPositionWithEarnings[];
  chainId: SupportedNetworks;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  period: EarningsPeriod;
  periodLabel: string;
  onPeriodChange: (period: EarningsPeriod) => void;
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
            showId
            showLltv
            showOracle
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

      {/* Live APY */}
      <TableCell
        className="px-4 py-3 text-right"
        style={{ minWidth: '80px' }}
      >
        <Tooltip
          content={
            <TooltipContent
              title={`Live ${rateLabel}`}
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
  period,
  periodLabel,
  onPeriodChange,
  isOwner,
  onRefetch,
  isRefetching,
}: MarketsBreakdownTableProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsOpenChange } = useDisclosure();

  const sortedMarkets = useMemo(() => {
    return [...markets].sort((a, b) => {
      const aSupply = BigInt(a.state.supplyAssets);
      const bSupply = BigInt(b.state.supplyAssets);
      return bSupply > aSupply ? 1 : bSupply < aSupply ? -1 : 0;
    });
  }, [markets]);

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
      <Tooltip
        content={
          <TooltipContent
            title="Table Settings"
            detail="Configure realized rate timeframe"
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="text-secondary min-w-0 px-2"
          onClick={onSettingsOpen}
        >
          <GearIcon className="h-3 w-3" />
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
              style={{ minWidth: '80px' }}
            >
              Live {rateLabel}
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

      <Modal
        isOpen={isSettingsOpen}
        onOpenChange={onSettingsOpenChange}
        size="md"
        backdrop="opaque"
        zIndex="settings"
      >
        {(close) => (
          <>
            <ModalHeader
              variant="compact"
              title="Table Settings"
              description="Configure realized rate timeframe"
              mainIcon={<GearIcon />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="flex flex-col gap-4"
            >
              <FilterSection
                title="Timeframe"
                helper="Used for realized rate and earned values"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="font-zen text-sm font-medium text-primary">Period</span>
                    <span className="font-zen text-xs text-secondary">Based on your balance over time</span>
                  </div>
                  <PositionPeriodSelector
                    period={period}
                    onPeriodChange={onPeriodChange}
                    className="w-[120px]"
                    contentClassName="z-[3600]"
                  />
                </div>
              </FilterSection>
              <Divider />
            </ModalBody>
            <ModalFooter className="justify-end">
              <Button
                color="primary"
                size="sm"
                onClick={close}
              >
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}

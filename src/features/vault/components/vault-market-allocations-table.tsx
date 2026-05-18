'use client';

import { useMemo } from 'react';
import { PulseLoader } from 'react-spinners';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { AllocationCell } from '@/features/positions/components/allocation-cell';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import type { MarketAllocation } from '@/types/vaultAllocations';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';
import type { Market, MarketPositionWithEarnings } from '@/utils/types';
import { calculateAllocationPercent, formatVaultAbsoluteCap, parseRelativeCap } from '@/utils/vaultAllocation';

export type VaultMarketAllocationsTableMode = 'summary' | 'position';

type VaultMarketAllocationsTableRow = {
  market: Market;
  allocation: MarketAllocation;
  currentSupplyAssets?: bigint;
  earnedAssets?: bigint;
  realizedApy?: number | null;
};

type VaultMarketAllocationsTableProps = {
  marketAllocations: MarketAllocation[];
  chainId: SupportedNetworks;
  totalAssets?: bigint;
  mode?: VaultMarketAllocationsTableMode;
  positions?: MarketPositionWithEarnings[];
  periodLabel?: string;
  isEarningsLoading?: boolean;
  allocationAssetSymbol?: string;
  allocationAssetDecimals?: number;
  showExplorerLink?: boolean;
};

const sortRows = (rows: VaultMarketAllocationsTableRow[], mode: VaultMarketAllocationsTableMode) => {
  return [...rows].sort((a, b) => {
    const aValue = mode === 'position' ? (a.currentSupplyAssets ?? a.allocation.allocation) : a.allocation.allocation;
    const bValue = mode === 'position' ? (b.currentSupplyAssets ?? b.allocation.allocation) : b.allocation.allocation;
    return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
  });
};

export function VaultMarketAllocationsTable({
  marketAllocations,
  chainId,
  totalAssets,
  mode = 'summary',
  positions = [],
  periodLabel,
  isEarningsLoading = false,
  allocationAssetSymbol,
  allocationAssetDecimals,
  showExplorerLink = false,
}: VaultMarketAllocationsTableProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const positionByMarket = useMemo(() => {
    const nextMap = new Map<string, MarketPositionWithEarnings>();

    for (const position of positions) {
      nextMap.set(position.market.uniqueKey.toLowerCase(), position);
    }

    return nextMap;
  }, [positions]);

  const rows = useMemo<VaultMarketAllocationsTableRow[]>(() => {
    return marketAllocations.map((allocation) => {
      const market = allocation.market;
      const position = positionByMarket.get(market.uniqueKey.toLowerCase());

      return {
        market,
        allocation,
        currentSupplyAssets: position ? BigInt(position.state.supplyAssets) : allocation.allocation,
        earnedAssets: position?.earned ? BigInt(position.earned) : 0n,
        realizedApy: position?.actualApy,
      };
    });
  }, [chainId, marketAllocations, positionByMarket]);

  const sortedRows = useMemo(() => sortRows(rows, mode), [rows, mode]);
  const totalAllocation = useMemo(() => {
    if (totalAssets !== undefined) return totalAssets;
    return marketAllocations.reduce((sum, allocation) => sum + allocation.allocation, 0n);
  }, [marketAllocations, totalAssets]);
  const isPositionMode = mode === 'position';

  return (
    <Table className="w-full font-zen">
      <TableHeader>
        <TableRow className="text-xs text-secondary">
          <TableHead className="px-4 py-3 text-left font-normal">Market</TableHead>
          <TableHead className="px-4 py-3 text-right font-normal">Allocation</TableHead>
          {isPositionMode ? (
            <>
              <TableHead className="px-4 py-3 text-right font-normal">Current Supply</TableHead>
              <TableHead className="px-4 py-3 text-right font-normal">
                <Tooltip
                  content={
                    <TooltipContent
                      title={`Realized ${rateLabel}${periodLabel ? ` (${periodLabel})` : ''}`}
                      detail="Annualized yield from interest earned over the selected period, weighted by balance over time."
                    />
                  }
                >
                  <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                    Realized {rateLabel}
                    {periodLabel ? ` (${periodLabel})` : ''}
                  </span>
                </Tooltip>
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-normal">
                <Tooltip
                  content={
                    <TooltipContent
                      title={`Interest Earned${periodLabel ? ` (${periodLabel})` : ''}`}
                      detail="Interest accrued by this market over the selected period."
                    />
                  }
                >
                  <span className="cursor-help border-b border-dotted border-secondary font-normal text-secondary/80">
                    Earned{periodLabel ? ` (${periodLabel})` : ''}
                  </span>
                </Tooltip>
              </TableHead>
            </>
          ) : (
            <>
              <TableHead className="px-4 py-3 text-right font-normal">{rateLabel}</TableHead>
              <TableHead className="px-4 py-3 text-right font-normal">Liquidity</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className="text-sm">
        {sortedRows.map((row) => {
          const { market, allocation } = row;
          const assetSymbol = allocationAssetSymbol ?? market.loanAsset.symbol;
          const assetDecimals = allocationAssetDecimals ?? market.loanAsset.decimals;
          const allocationValue = formatBalance(allocation.allocation, assetDecimals);
          const percentage = totalAllocation > 0n ? Number.parseFloat(calculateAllocationPercent(allocation.allocation, totalAllocation)) : 0;
          const relativeCap = parseRelativeCap(allocation.relativeCap);
          const capLabel = `${relativeCap === undefined ? '-' : `${relativeCap.toFixed(2)}%`} / ${formatVaultAbsoluteCap(
            allocation.absoluteCap,
            assetDecimals,
            assetSymbol,
          )}`;
          const displayRate = isAprDisplay ? convertApyToApr(market.state.supplyApy) : market.state.supplyApy;
          const currentSupplyAssets = row.currentSupplyAssets ?? allocation.allocation;
          const currentSupply = formatBalance(currentSupplyAssets, market.loanAsset.decimals);
          const realizedRate = isAprDisplay ? convertApyToApr(row.realizedApy ?? 0) : row.realizedApy ?? 0;
          const earnedAssets = row.earnedAssets ?? 0n;
          const liquidity = formatReadable(formatBalance(BigInt(market.state.liquidityAssets || 0), market.loanAsset.decimals).toString());

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
                  showExplorerLink={showExplorerLink}
                />
              </TableCell>
              <TableCell
                className="px-4 py-3"
                style={{ minWidth: '150px' }}
              >
                <AllocationCell
                  amount={allocationValue}
                  symbol={assetSymbol}
                  percentage={percentage}
                  capPercentage={relativeCap}
                  capLabel={capLabel}
                  compact
                />
              </TableCell>
              {isPositionMode ? (
                <>
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
                    ) : realizedRate === 0 ? (
                      <span className="text-secondary">-</span>
                    ) : (
                      <span>{(realizedRate * 100).toFixed(2)}%</span>
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
                    ) : earnedAssets === 0n ? (
                      <span className="text-secondary">-</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <span>
                          <span className="font-inter">+</span>
                          {formatReadable(formatBalance(earnedAssets, market.loanAsset.decimals))}
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
                </>
              ) : (
                <>
                  <TableCell className="px-4 py-3 text-right text-xs text-secondary whitespace-nowrap">
                    {(displayRate * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-xs text-secondary whitespace-nowrap">{liquidity}</TableCell>
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

'use client';

import { useMemo } from 'react';
import { PulseLoader } from 'react-spinners';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { formatRateAsPercentage, toDisplayRateFromApy } from '@/utils/rateMath';
import type { Market, MarketPositionWithEarnings } from '@/utils/types';
import { calculateAllocationPercent, formatVaultAbsoluteCap, parseRelativeCap } from '@/utils/vaultAllocation';

export type VaultMarketAllocationsTableMode = 'summary' | 'position';

type VaultMarketAllocationsTableRow = {
  market: Market;
  allocation: MarketAllocation;
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
  allocationAssetAddress?: string;
  allocationAssetSymbol?: string;
  allocationAssetDecimals?: number;
  showExplorerLink?: boolean;
};

const sortRows = (rows: VaultMarketAllocationsTableRow[]) => {
  return [...rows].sort((a, b) => {
    const aValue = a.allocation.allocation;
    const bValue = b.allocation.allocation;
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
  allocationAssetAddress,
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
        earnedAssets: position?.earned ? BigInt(position.earned) : 0n,
        realizedApy: position?.actualApy,
      };
    });
  }, [marketAllocations, positionByMarket]);

  const sortedRows = useMemo(() => sortRows(rows), [rows]);
  const allocatedAssets = useMemo(() => {
    return marketAllocations.reduce((sum, allocation) => sum + allocation.allocation, 0n);
  }, [marketAllocations]);
  const totalAllocation = useMemo(() => {
    if (totalAssets !== undefined) return totalAssets;
    return allocatedAssets;
  }, [allocatedAssets, totalAssets]);
  const idleAllocation = totalAssets !== undefined && totalAssets > allocatedAssets ? totalAssets - allocatedAssets : 0n;
  const idleAsset = {
    address: allocationAssetAddress ?? sortedRows[0]?.market.loanAsset.address,
    decimals: allocationAssetDecimals ?? sortedRows[0]?.market.loanAsset.decimals,
    symbol: allocationAssetSymbol ?? sortedRows[0]?.market.loanAsset.symbol,
  };
  const isPositionMode = mode === 'position';
  const formatDisplayRate = (apy: number | null | undefined) => {
    if (apy === null || apy === undefined || !Number.isFinite(apy)) return '-';
    return formatRateAsPercentage(toDisplayRateFromApy(apy, isAprDisplay));
  };

  return (
    <Table className="w-full font-zen">
      <TableHeader>
        <TableRow className="text-xs text-secondary">
          <TableHead className="px-4 py-3 text-left font-normal">Market</TableHead>
          <TableHead className="px-4 py-3 text-right font-normal">Allocation</TableHead>
          {isPositionMode ? (
            <>
              <TableHead className="px-4 py-3 text-right font-normal">Live {rateLabel}</TableHead>
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
            <TableHead className="px-4 py-3 text-right font-normal">Live {rateLabel}</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className="text-sm">
        {sortedRows.map((row) => {
          const { market, allocation } = row;
          const assetSymbol = allocationAssetSymbol ?? market.loanAsset.symbol;
          const assetDecimals = allocationAssetDecimals ?? market.loanAsset.decimals;
          const allocationValue = formatBalance(allocation.allocation, assetDecimals);
          const percentage =
            totalAllocation > 0n ? Number.parseFloat(calculateAllocationPercent(allocation.allocation, totalAllocation)) : 0;
          const relativeCap = parseRelativeCap(allocation.relativeCap);
          const capLabel = `${relativeCap === undefined ? '-' : `${relativeCap.toFixed(2)}%`} / ${formatVaultAbsoluteCap(
            allocation.absoluteCap,
            assetDecimals,
            assetSymbol,
          )}`;
          const liveRate = formatDisplayRate(market.state.supplyApy);
          const realizedRate = toDisplayRateFromApy(row.realizedApy ?? 0, isAprDisplay);
          const earnedAssets = row.earnedAssets ?? 0n;

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
                    className="px-4 py-3 text-right text-xs whitespace-nowrap"
                    style={{ minWidth: '110px' }}
                  >
                    {liveRate}
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
                <TableCell className="px-4 py-3 text-right text-xs whitespace-nowrap">{liveRate}</TableCell>
              )}
            </TableRow>
          );
        })}
        {idleAllocation > 0n && idleAsset.decimals !== undefined && idleAsset.symbol && (
          <TableRow className="hover:bg-hovered">
            <TableCell
              className="px-4 py-3"
              style={{ minWidth: '220px' }}
            >
              <div className="flex items-center gap-2">
                {idleAsset.address && (
                  <TokenIcon
                    address={idleAsset.address}
                    chainId={chainId}
                    symbol={idleAsset.symbol}
                    width={18}
                    height={18}
                  />
                )}
                <span className="whitespace-nowrap text-primary">{idleAsset.symbol}</span>
                <span className="text-secondary">/</span>
                <span className="whitespace-nowrap text-secondary">empty</span>
                <Badge
                  variant="default"
                  size="sm"
                  className="ml-1 font-normal"
                >
                  idle
                </Badge>
              </div>
            </TableCell>
            <TableCell
              className="px-4 py-3"
              style={{ minWidth: '150px' }}
            >
              <AllocationCell
                amount={formatBalance(idleAllocation, idleAsset.decimals)}
                symbol={idleAsset.symbol}
                percentage={totalAllocation > 0n ? Number.parseFloat(calculateAllocationPercent(idleAllocation, totalAllocation)) : 0}
                compact
              />
            </TableCell>
            {isPositionMode ? (
              <>
                <TableCell
                  className="px-4 py-3 text-right text-xs whitespace-nowrap"
                  style={{ minWidth: '110px' }}
                >
                  {formatDisplayRate(0)}
                </TableCell>
                <TableCell
                  className="px-4 py-3 text-right text-secondary"
                  style={{ minWidth: '130px' }}
                >
                  -
                </TableCell>
                <TableCell
                  className="px-4 py-3 text-right text-secondary"
                  style={{ minWidth: '120px' }}
                >
                  -
                </TableCell>
              </>
            ) : (
              <TableCell className="px-4 py-3 text-right text-xs whitespace-nowrap">{formatDisplayRate(0)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

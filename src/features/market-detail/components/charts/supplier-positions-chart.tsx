'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Address } from 'viem';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useChartColors } from '@/constants/chartColors';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { useAllMarketSuppliers } from '@/hooks/useAllMarketPositions';
import { useHistoricalSupplierPositions } from '@/hooks/useHistoricalSupplierPositions';
import { useMarketDetailChartState, calculateTimePoints } from '@/stores/useMarketDetailChartState';
import { formatSimple, formatReadable } from '@/utils/balance';
import { formatChartTime } from '@/utils/chart';
import { getSlicedAddress } from '@/utils/address';
import { chartTooltipCursor } from './chart-utils';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

type SupplierPositionsChartProps = {
  marketId: string;
  chainId: SupportedNetworks;
  market: Market;
};

const TOP_SUPPLIERS_TO_SHOW = 5;

// Custom tooltip component at module scope
function SupplierPositionsTooltip({
  active,
  payload,
  getDisplayName,
  formatValue,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; payload: { timestamp: number; blockNumber: number } }[];
  getDisplayName: (address: string) => string;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0]?.payload;
  const timestamp = dataPoint?.timestamp ?? 0;
  const blockNumber = dataPoint?.blockNumber;

  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
      <div className="mb-2 space-y-0.5">
        <p className="text-xs text-secondary">
          {new Date(timestamp * 1000).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        {blockNumber && <p className="font-mono text-xs text-secondary/70">Block #{blockNumber.toLocaleString()}</p>}
      </div>
      <div className="space-y-1">
        {payload
          .filter((entry) => entry.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((entry) => (
            <div
              key={entry.dataKey}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="max-w-[120px] truncate text-secondary">{getDisplayName(entry.dataKey)}</span>
              </div>
              <span className="tabular-nums">{formatValue(entry.value)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function SupplierPositionsChart({ marketId, chainId, market }: SupplierPositionsChartProps) {
  const selectedTimeframe = useMarketDetailChartState((s) => s.selectedTimeframe);
  const selectedTimeRange = useMarketDetailChartState((s) => s.selectedTimeRange);
  const chartColors = useChartColors();
  const { getVaultByAddress } = useVaultRegistry();

  const { data: suppliers, isLoading: suppliersLoading } = useAllMarketSuppliers(market.uniqueKey, chainId);

  const totalSupplyShares = BigInt(market.state.supplyShares);
  const totalSupplyAssets = BigInt(market.state.supplyAssets);

  const {
    data: historicalData,
    suppliers: topSuppliers,
    isLoading: historyLoading,
  } = useHistoricalSupplierPositions(
    marketId,
    chainId,
    selectedTimeframe,
    suppliers,
    totalSupplyShares,
    totalSupplyAssets,
    market.loanAsset.decimals,
  );

  // Track which lines have been explicitly toggled by user
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({});

  // Compute visibility: show top 5 by default, respect user toggles
  const effectiveVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    for (const [index, supplier] of topSuppliers.entries()) {
      visibility[supplier.address] = visibleLines[supplier.address] ?? index < TOP_SUPPLIERS_TO_SHOW;
    }
    return visibility;
  }, [topSuppliers, visibleLines]);

  // Get display name for a supplier address
  const getDisplayName = useCallback(
    (address: string): string => {
      const vault = getVaultByAddress(address as Address, chainId);
      if (vault?.name) return vault.name;
      return getSlicedAddress(address as `0x${string}`);
    },
    [getVaultByAddress, chainId],
  );

  const handleLegendClick = useCallback(
    (dataKey: string) => {
      setVisibleLines((prev) => ({
        ...prev,
        [dataKey]: !(prev[dataKey] ?? topSuppliers.findIndex((s) => s.address === dataKey) < TOP_SUPPLIERS_TO_SHOW),
      }));
    },
    [topSuppliers],
  );

  const formatValue = (value: number) => `${formatSimple(value)} ${market.loanAsset.symbol}`;

  const isLoading = suppliersLoading || historyLoading;

  // Calculate data coverage - how much of the requested timeframe has data
  const dataCoverage = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return null;

    const expectedPoints = calculateTimePoints(selectedTimeframe).length;
    const actualPoints = historicalData.length;
    const percentage = Math.round((actualPoints / expectedPoints) * 100);

    // Get the earliest data point date
    const earliestTimestamp = historicalData[0]?.timestamp;
    const earliestDate = earliestTimestamp ? new Date(earliestTimestamp * 1000) : null;

    return {
      percentage,
      expectedPoints,
      actualPoints,
      earliestDate,
      isPartial: percentage < 90,
    };
  }, [historicalData, selectedTimeframe]);

  // Custom legend with toggleable items
  const renderLegend = () => (
    <div className="flex flex-wrap justify-center gap-3 px-4 pt-2">
      {topSuppliers.map((supplier, index) => {
        const isVisible = effectiveVisibility[supplier.address];
        const color = chartColors.pie[index % chartColors.pie.length];

        return (
          <button
            key={supplier.address}
            type="button"
            onClick={() => handleLegendClick(supplier.address)}
            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors hover:bg-hovered"
            style={{ opacity: isVisible ? 1 : 0.4 }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span
              className="max-w-[100px] truncate"
              style={{ color: isVisible ? 'var(--color-text-secondary)' : '#666' }}
            >
              {getDisplayName(supplier.address)}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="flex h-[400px] items-center justify-center border border-border bg-surface">
        <Spinner size={24} />
      </Card>
    );
  }

  if (!historicalData || historicalData.length === 0 || topSuppliers.length === 0) {
    return (
      <Card className="flex h-[400px] flex-col items-center justify-center border border-border bg-surface">
        <p className="text-secondary">No historical supplier data available</p>
        <p className="mt-1 text-xs text-secondary">
          {topSuppliers.length === 0 ? 'No suppliers found for this market' : 'Try a different timeframe'}
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div>
          <h4 className="text-lg text-secondary">Supplier Position Changes</h4>
          <p className="mt-0.5 text-xs text-secondary">
            {dataCoverage?.isPartial && dataCoverage.earliestDate
              ? `Data available from ${dataCoverage.earliestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Track how top supplier positions change over time'}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-secondary">{topSuppliers.length} suppliers tracked</span>
          {dataCoverage?.isPartial && (
            <p className="mt-0.5 text-xs text-secondary/70">
              {dataCoverage.actualPoints}/{dataCoverage.expectedPoints} data points
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full px-4 py-4">
        <ResponsiveContainer
          width="100%"
          height={300}
        >
          <LineChart
            data={historicalData}
            margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--color-border)"
              strokeOpacity={0.25}
            />
            <XAxis
              dataKey="timestamp"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              minTickGap={60}
              tickFormatter={(time) => formatChartTime(time, selectedTimeRange.endTimestamp - selectedTimeRange.startTimestamp)}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={formatReadable}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              width={60}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={chartTooltipCursor}
              content={<SupplierPositionsTooltip getDisplayName={getDisplayName} formatValue={formatValue} />}
            />
            {topSuppliers.map((supplier, index) => (
              <Line
                key={supplier.address}
                type="monotone"
                dataKey={supplier.address}
                name={getDisplayName(supplier.address)}
                stroke={chartColors.pie[index % chartColors.pie.length]}
                strokeWidth={2}
                dot={false}
                hide={!effectiveVisibility[supplier.address]}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Custom Legend */}
        {renderLegend()}
      </div>
    </Card>
  );
}

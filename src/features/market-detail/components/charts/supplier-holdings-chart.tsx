import { useState, useMemo, useCallback } from 'react';
import type { Address } from 'viem';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { useChartColors } from '@/constants/chartColors';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { formatReadable } from '@/utils/balance';
import { formatChartTime } from '@/utils/chart';
import { getSlicedAddress } from '@/utils/address';
import { useSupplierPositionHistory, type SupplierHoldingsTimeframe } from '@/hooks/useSupplierPositionHistory';
import { chartTooltipCursor, chartLegendStyle } from './chart-utils';
import type { Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type SupplierHoldingsChartProps = {
  marketId: string;
  chainId: SupportedNetworks;
  market: Market;
};

const TIMEFRAME_LABELS: Record<SupplierHoldingsTimeframe, string> = {
  '7d': '7D',
  '30d': '30D',
};

function SupplierHoldingsChart({ marketId, chainId, market }: SupplierHoldingsChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<SupplierHoldingsTimeframe>('7d');
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({});
  const chartColors = useChartColors();
  const { getVaultByAddress } = useVaultRegistry();

  const { data, suppliers, isLoading } = useSupplierPositionHistory(marketId, chainId, market, selectedTimeframe);

  // Initialize visible lines when suppliers change
  useMemo(() => {
    if (suppliers.length > 0 && Object.keys(visibleLines).length === 0) {
      const initial: Record<string, boolean> = {};
      for (const supplier of suppliers) {
        initial[supplier.address.toLowerCase()] = true;
      }
      setVisibleLines(initial);
    }
  }, [suppliers, visibleLines]);

  // Calculate duration for time formatting
  const durationSeconds = useMemo(() => {
    if (selectedTimeframe === '7d') return 7 * 24 * 60 * 60;
    return 30 * 24 * 60 * 60;
  }, [selectedTimeframe]);

  // Get display name for an address (vault name or shortened address)
  const getDisplayName = useCallback(
    (address: string): string => {
      const vault = getVaultByAddress(address as Address, chainId);
      if (vault?.name) return vault.name;
      return getSlicedAddress(address as `0x${string}`);
    },
    [getVaultByAddress, chainId],
  );

  const formatValue = (value: number) => {
    const formattedValue = formatReadable(value);
    return `${formattedValue} ${market.loanAsset.symbol}`;
  };

  const formatYAxis = (value: number) => {
    return formatReadable(value);
  };

  // Handle legend click to toggle line visibility
  const handleLegendClick = useCallback((legendData: { dataKey?: string | number | ((entry: unknown) => unknown) }) => {
    const key = typeof legendData.dataKey === 'string' ? legendData.dataKey : '';
    if (!key) return;
    setVisibleLines((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Custom legend formatter
  const legendFormatter = useCallback(
    (value: string, entry: { dataKey?: string | number | ((entry: unknown) => unknown) }) => {
      const addr = typeof entry.dataKey === 'string' ? entry.dataKey : '';
      const isVisible = addr ? visibleLines[addr] !== false : true;
      const displayName = addr ? getDisplayName(addr) : value;
      return (
        <span
          className="text-xs"
          style={{
            color: isVisible ? 'var(--color-text-secondary)' : '#666',
            cursor: 'pointer',
          }}
        >
          {displayName}
        </span>
      );
    },
    [visibleLines, getDisplayName],
  );

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Sort payload by value descending
    const sortedPayload = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-2 text-xs text-secondary">
          {new Date((label ?? 0) * 1000).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <div className="max-h-[200px] space-y-1 overflow-y-auto">
          {sortedPayload.map((entry) => {
            if (entry.value === undefined || entry.value === null) return null;
            const displayName = getDisplayName(entry.dataKey);
            return (
              <div
                key={entry.dataKey}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="max-w-[120px] truncate text-secondary">{displayName}</span>
                </div>
                <div className="flex items-center gap-1 tabular-nums">
                  <span>{formatReadable(entry.value)}</span>
                  <TokenIcon
                    address={market.loanAsset.address}
                    chainId={market.morphoBlue.chain.id}
                    symbol={market.loanAsset.symbol}
                    width={14}
                    height={14}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (suppliers.length === 0) return null;

    const totalCurrent = suppliers.reduce((sum, s) => sum + s.currentPosition, 0);
    const topSupplier = suppliers[0];

    return {
      supplierCount: suppliers.length,
      totalTracked: totalCurrent,
      topSupplierValue: topSupplier?.currentPosition ?? 0,
      topSupplierName: topSupplier ? getDisplayName(topSupplier.address) : '',
    };
  }, [suppliers, getDisplayName]);

  if (isLoading) {
    return (
      <Card className="flex min-h-[400px] items-center justify-center border border-border bg-surface">
        <Spinner size={24} />
      </Card>
    );
  }

  if (data.length === 0 || suppliers.length === 0) {
    return (
      <Card className="flex min-h-[400px] items-center justify-center border border-border bg-surface">
        <p className="text-secondary">No supplier position history available</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Stats + Controls */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Stats */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Top Suppliers</p>
            <span className="tabular-nums text-lg">{stats?.supplierCount ?? 0}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Total Tracked</p>
            <span className="tabular-nums text-lg">{formatValue(stats?.totalTracked ?? 0)}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Largest Supplier</p>
            <div className="flex items-baseline gap-2">
              <span className="max-w-[150px] truncate text-sm text-secondary">{stats?.topSupplierName}</span>
              <span className="tabular-nums text-lg">{formatValue(stats?.topSupplierValue ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Select
            value={selectedTimeframe}
            onValueChange={(value) => setSelectedTimeframe(value as SupplierHoldingsTimeframe)}
          >
            <SelectTrigger className="h-8 w-auto min-w-[60px] px-3 text-sm">
              <SelectValue>{TIMEFRAME_LABELS[selectedTimeframe]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7D</SelectItem>
              <SelectItem value="30d">30D</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart Body */}
      <div className="w-full">
        <ResponsiveContainer
          width="100%"
          height={350}
          id="supplier-holdings-chart"
        >
          <LineChart
            data={data}
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
              tickFormatter={(time) => formatChartTime(time, durationSeconds)}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              width={70}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={chartTooltipCursor}
              content={<CustomTooltip />}
            />
            <Legend
              {...chartLegendStyle}
              onClick={handleLegendClick}
              formatter={legendFormatter}
            />
            {suppliers.map((supplier, index) => {
              const addr = supplier.address.toLowerCase();
              const isVisible = visibleLines[addr] !== false;
              return (
                <Line
                  key={addr}
                  type="monotone"
                  dataKey={addr}
                  name={getDisplayName(addr)}
                  stroke={chartColors.pie[index % chartColors.pie.length]}
                  strokeWidth={2}
                  dot={false}
                  hide={!isVisible}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer: Legend info */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <p className="text-xs text-secondary">Click legend items to show/hide individual supplier lines</p>
        </div>
      </div>
    </Card>
  );
}

export default SupplierHoldingsChart;

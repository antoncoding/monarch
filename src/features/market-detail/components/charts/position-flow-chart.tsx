import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { useChartColors } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import { formatChartTime } from '@/utils/chart';
import { useMarketPositionFlow, type PositionFlowTimeframe } from '@/hooks/useMarketPositionFlow';
import { ChartGradients, chartTooltipCursor } from './chart-utils';
import type { Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type PositionFlowChartProps = {
  marketId: string;
  chainId: SupportedNetworks;
  market: Market;
};

const TIMEFRAME_LABELS: Record<PositionFlowTimeframe, string> = {
  '7d': '7D',
  '30d': '30D',
};

function PositionFlowChart({ marketId, chainId, market }: PositionFlowChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<PositionFlowTimeframe>('7d');
  const chartColors = useChartColors();

  const {
    data: flowData,
    stats,
    isLoading,
  } = useMarketPositionFlow(marketId, market.loanAsset.id, chainId, selectedTimeframe, market.loanAsset.decimals);

  // Calculate duration for time formatting
  const durationSeconds = useMemo(() => {
    if (selectedTimeframe === '7d') return 7 * 24 * 60 * 60;
    return 30 * 24 * 60 * 60;
  }, [selectedTimeframe]);

  const formatValue = (value: number) => {
    const formattedValue = formatReadable(Math.abs(value));
    const prefix = value >= 0 ? '+' : '-';
    return `${prefix}${formattedValue} ${market.loanAsset.symbol}`;
  };

  const formatYAxis = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${formatReadable(value)}`;
  };

  // Create gradient configs for positive and negative bars
  const flowGradients = useMemo(
    () => [
      { id: 'positiveFlowGradient', color: chartColors.supply.stroke },
      { id: 'negativeFlowGradient', color: chartColors.withdraw.stroke },
    ],
    [chartColors],
  );

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-2 text-xs text-secondary">
          {new Date(label * 1000).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: chartColors.supply.stroke }}
              />
              <span className="text-secondary">Supply</span>
            </div>
            <span className="tabular-nums">
              +{formatReadable(data.supplyVolume)} {market.loanAsset.symbol}
            </span>
          </div>
          <div className="flex items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: chartColors.withdraw.stroke }}
              />
              <span className="text-secondary">Withdraw</span>
            </div>
            <span className="tabular-nums">
              -{formatReadable(data.withdrawVolume)} {market.loanAsset.symbol}
            </span>
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <div className="flex items-center justify-between gap-6 text-sm font-medium">
              <span className="text-secondary">Net Flow</span>
              <span className={`tabular-nums ${data.netFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatValue(data.netFlow)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Stats + Controls */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Stats */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Net Flow</p>
            <div className="flex items-baseline gap-2">
              <span className={`tabular-nums text-lg ${stats.totalNetFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatValue(stats.totalNetFlow)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Total Supply</p>
            <span className="tabular-nums text-lg">
              +{formatReadable(stats.totalSupply)} {market.loanAsset.symbol}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Total Withdraw</p>
            <span className="tabular-nums text-lg">
              -{formatReadable(stats.totalWithdraw)} {market.loanAsset.symbol}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Select
            value={selectedTimeframe}
            onValueChange={(value) => setSelectedTimeframe(value as PositionFlowTimeframe)}
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
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center text-primary">
            <Spinner size={30} />
          </div>
        ) : flowData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-secondary">No position flow data available for this period</div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={300}
            id="position-flow-chart"
          >
            <BarChart
              data={flowData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="positionFlow"
                gradients={flowGradients}
              />
              <CartesianGrid
                strokeDasharray="0"
                stroke="var(--color-border)"
                strokeOpacity={0.25}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                minTickGap={40}
                tickFormatter={(time) => formatChartTime(time, durationSeconds)}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={70}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                content={<CustomTooltip />}
              />
              <ReferenceLine
                y={0}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <Bar
                dataKey="netFlow"
                name="Net Flow"
                radius={[4, 4, 0, 0]}
              >
                {flowData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.netFlow >= 0 ? chartColors.supply.stroke : chartColors.withdraw.stroke}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: Average info */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Avg. Daily Flow</span>
            <span className={`tabular-nums text-sm ${stats.avgDailyFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatValue(stats.avgDailyFlow)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: chartColors.supply.stroke }}
            />
            <span className="text-xs text-secondary">Inflow (Supply)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: chartColors.withdraw.stroke }}
            />
            <span className="text-xs text-secondary">Outflow (Withdraw)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default PositionFlowChart;

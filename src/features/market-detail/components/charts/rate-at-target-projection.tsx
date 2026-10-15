import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useChartColors } from '@/constants/chartColors';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatChartTime } from '@/utils/chart';
import { getIRMTitle } from '@/utils/morpho';
import { toApyFromDisplayRate, toDisplayRateFromApy } from '@/utils/rateMath';
import type { Market } from '@/utils/types';
import {
  buildRateAtTargetProjection,
  estimateTimeToTargetRate,
  getCurrentRateAtTarget,
  projectRateAtTargetApy,
  RATE_AT_TARGET_UTILIZATION,
  type TargetRateEstimate,
} from '../../utils/rate-at-target-projection';
import { chartTooltipCursor, ChartTooltipContent } from './chart-utils';

const SECONDS_PER_DAY = 86_400;
const HORIZON_OPTIONS = [7, 30, 90] as const;

type RateAtTargetProjectionProps = {
  market: Market;
};

const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;

const formatTimeToTarget = (estimate: TargetRateEstimate): string => {
  if (estimate.status === 'static') return 'No change at target utilization';
  if (estimate.status === 'unreachable') return 'Not reached at constant utilization';
  if (estimate.status === 'invalid') return 'Enter a valid target';
  if (estimate.seconds === 0) return 'Already at desired rate';

  const days = estimate.seconds / SECONDS_PER_DAY;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} hours`;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
};

export function RateAtTargetProjection({ market }: RateAtTargetProjectionProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const chartColors = useChartColors();
  const [horizonDays, setHorizonDays] = useState<(typeof HORIZON_OPTIONS)[number]>(30);
  const [projectionTimestamp] = useState(() => Math.floor(Date.now() / 1000));

  const storedRateAtTarget = useMemo(() => {
    try {
      return BigInt(market.state.rateAtTarget);
    } catch {
      return 0n;
    }
  }, [market.state.rateAtTarget]);

  const currentRateAtTarget = useMemo(
    () =>
      getCurrentRateAtTarget({
        utilization: market.state.utilization,
        storedRateAtTarget,
        lastUpdateTimestamp: market.state.timestamp,
        currentTimestamp: projectionTimestamp,
      }),
    [market.state.timestamp, market.state.utilization, projectionTimestamp, storedRateAtTarget],
  );
  const currentApyAtTarget = projectRateAtTargetApy({
    utilization: market.state.utilization,
    rateAtTarget: currentRateAtTarget,
    elapsedSeconds: 0,
  });
  const direction =
    market.state.utilization > RATE_AT_TARGET_UTILIZATION ? 1 : market.state.utilization < RATE_AT_TARGET_UTILIZATION ? -1 : 0;
  const [desiredApy, setDesiredApy] = useState<number | null>(() => currentApyAtTarget * (direction > 0 ? 1.25 : direction < 0 ? 0.75 : 1));

  const projection = useMemo(
    () =>
      buildRateAtTargetProjection({
        utilization: market.state.utilization,
        rateAtTarget: currentRateAtTarget,
        startTimestamp: projectionTimestamp,
        horizonDays,
      }).map((point) => ({
        x: point.timestamp,
        projectedRate: toDisplayRateFromApy(point.apyAtTarget, isAprDisplay),
      })),
    [currentRateAtTarget, horizonDays, isAprDisplay, market.state.utilization, projectionTimestamp],
  );
  const projectedRate = projection.at(-1)?.projectedRate ?? 0;
  const currentDisplayRate = toDisplayRateFromApy(currentApyAtTarget, isAprDisplay);
  const desiredDisplayRate = desiredApy == null ? null : toDisplayRateFromApy(desiredApy, isAprDisplay);
  const targetEstimate = useMemo(
    () =>
      desiredApy == null
        ? ({ status: 'invalid' } as const)
        : estimateTimeToTargetRate({
            utilization: market.state.utilization,
            rateAtTarget: currentRateAtTarget,
            desiredApy,
          }),
    [currentRateAtTarget, desiredApy, market.state.utilization],
  );
  const projectionSeconds = horizonDays * SECONDS_PER_DAY;

  if (getIRMTitle(market.irmAddress) !== 'Adaptive Curve' || storedRateAtTarget <= 0n) return null;

  return (
    <Card className="mt-6 overflow-hidden border border-border bg-surface shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-secondary">Constant-utilization scenario</p>
          <h3 className="mt-1 text-base font-medium">Rate at Target Projection</h3>
          <p className="mt-1 max-w-2xl text-xs text-secondary">
            Shows how the Adaptive Curve IRM shifts if utilization remains at {formatPercentage(market.state.utilization)}.
          </p>
        </div>
        <Select
          value={String(horizonDays)}
          onValueChange={(value) => setHorizonDays(Number(value) as (typeof HORIZON_OPTIONS)[number])}
        >
          <SelectTrigger
            className="h-8 w-[92px] px-3 text-sm"
            aria-label="Projection horizon"
          >
            <SelectValue>{horizonDays}D</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HORIZON_OPTIONS.map((days) => (
              <SelectItem
                key={days}
                value={String(days)}
              >
                {days}D
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-px border-b border-border/40 bg-border/40 sm:grid-cols-3">
        <div className="bg-surface px-6 py-3">
          <p className="text-xs text-secondary">Current target {rateLabel}</p>
          <p className="mt-1 tabular-nums text-lg">{formatPercentage(currentDisplayRate)}</p>
        </div>
        <div className="bg-surface px-6 py-3">
          <p className="text-xs text-secondary">Projected in {horizonDays} days</p>
          <p className="mt-1 tabular-nums text-lg">{formatPercentage(projectedRate)}</p>
        </div>
        <div className="bg-surface px-6 py-3">
          <p className="text-xs text-secondary">Direction at current utilization</p>
          <p className="mt-1 text-lg">{direction > 0 ? 'Rising' : direction < 0 ? 'Falling' : 'Stable'}</p>
        </div>
      </div>

      <div className="h-[280px] w-full px-2 py-4 sm:px-4">
        <ResponsiveContainer
          width="100%"
          height="100%"
          id="rate-at-target-projection"
        >
          <LineChart
            data={projection}
            margin={{ top: 12, right: 24, left: 8, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--color-border)"
              strokeOpacity={0.25}
            />
            <XAxis
              dataKey="x"
              type="number"
              scale="linear"
              domain={[projectionTimestamp, projectionTimestamp + projectionSeconds]}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              minTickGap={60}
              tickFormatter={(time) => formatChartTime(time, projectionSeconds)}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[0, (maximum: number) => Math.max(maximum * 1.1, 0.01)]}
              tickFormatter={(value) => formatPercentage(value)}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              width={52}
            />
            <Tooltip
              cursor={chartTooltipCursor}
              content={({ active, payload, label }) => (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  label={label}
                  formatValue={formatPercentage}
                />
              )}
            />
            {desiredDisplayRate == null ? null : (
              <ReferenceLine
                y={desiredDisplayRate}
                stroke="var(--color-text-secondary)"
                strokeDasharray="4 4"
                label={{ value: 'Desired', position: 'insideTopRight', fill: 'var(--color-text-secondary)', fontSize: 11 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="projectedRate"
              name={`Projected target ${rateLabel}`}
              stroke={chartColors.apyAtTarget.stroke}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-4 border-t border-border px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex w-full max-w-[220px] flex-col gap-1 text-xs text-secondary">
          Desired target {rateLabel}
          <div className="flex h-9 items-center rounded-sm border border-border bg-hovered px-3 focus-within:border-primary/60">
            <input
              key={`${market.uniqueKey}-${rateLabel}`}
              type="number"
              min="0"
              step="0.1"
              defaultValue={desiredApy == null ? '' : (toDisplayRateFromApy(desiredApy, isAprDisplay) * 100).toFixed(2)}
              onChange={(event) => {
                const parsed = Number.parseFloat(event.target.value);
                setDesiredApy(Number.isFinite(parsed) && parsed >= 0 ? toApyFromDisplayRate(parsed / 100, isAprDisplay) : null);
              }}
              className="w-full bg-transparent tabular-nums text-sm text-primary outline-none"
              aria-label={`Desired target ${rateLabel}`}
            />
            <span>%</span>
          </div>
        </label>
        <div className="sm:text-right">
          <p className="text-xs text-secondary">Estimated time to desired rate</p>
          <p className="mt-1 text-sm font-medium">{formatTimeToTarget(targetEstimate)}</p>
          <p className="mt-1 text-xs text-secondary">Assumes utilization and market parameters do not change.</p>
        </div>
      </div>
    </Card>
  );
}

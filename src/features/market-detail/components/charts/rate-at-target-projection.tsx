import { useMemo, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from '@radix-ui/react-icons';
import { FaRegLightbulb } from 'react-icons/fa';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Tooltip as UiTooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
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
  if (estimate.status !== 'reached') return '—';
  if (estimate.seconds === 0) return 'Now';

  const days = estimate.seconds / SECONDS_PER_DAY;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)}d`;
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
  const DirectionIcon = direction > 0 ? ArrowUpIcon : direction < 0 ? ArrowDownIcon : MinusIcon;
  const directionLabel = direction > 0 ? 'Rising' : direction < 0 ? 'Falling' : 'Stable';

  if (getIRMTitle(market.irmAddress) !== 'Adaptive Curve' || storedRateAtTarget <= 0n) return null;

  return (
    <Card className="mt-6 overflow-hidden border border-border bg-surface shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Target Rate Projection</h3>
          <UiTooltip
            content={
              <TooltipContent
                icon={<FaRegLightbulb className="h-4 w-4" />}
                title="Projection assumptions"
                detail="Utilization and market parameters stay constant."
              />
            }
          >
            <button
              type="button"
              aria-label="Projection assumptions"
              className="rounded-sm text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <FaRegLightbulb className="h-3.5 w-3.5" />
            </button>
          </UiTooltip>
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
          <p className="text-xs uppercase tracking-wider text-secondary">Now</p>
          <p className="mt-1 tabular-nums text-lg">{formatPercentage(currentDisplayRate)}</p>
        </div>
        <div className="bg-surface px-6 py-3">
          <p className="text-xs uppercase tracking-wider text-secondary">{horizonDays}D</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="tabular-nums text-lg">{formatPercentage(projectedRate)}</p>
            <DirectionIcon
              className="h-4 w-4 text-secondary"
              role="img"
              aria-label={directionLabel}
            />
          </div>
        </div>
        <div className="bg-surface px-6 py-3">
          <p className="text-xs uppercase tracking-wider text-secondary">Utilization</p>
          <p className="mt-1 tabular-nums text-lg">{formatPercentage(market.state.utilization)}</p>
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
                label={{ value: 'Target', position: 'insideTopRight', fill: 'var(--color-text-secondary)', fontSize: 11 }}
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
          Target {rateLabel}
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
          <p className="text-xs uppercase tracking-wider text-secondary">ETA</p>
          <p className="mt-1 text-sm font-medium">{formatTimeToTarget(targetEstimate)}</p>
        </div>
      </div>
    </Card>
  );
}

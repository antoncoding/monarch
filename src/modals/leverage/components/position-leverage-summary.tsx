import { formatMultiplierBps, ltvWadToBps, multiplierBpsFromTargetLtv } from '@/hooks/leverage/math';
import { LTV_WAD, formatLtvPercent, getLTVColor } from '@/modals/borrow/components/helpers';

type PositionLeverageSummaryProps = {
  currentLtv: bigint;
  projectedLtv: bigint;
  lltv: bigint;
  hasChanges: boolean;
};

const formatLeverageFromLtv = (ltv: bigint): string => {
  if (ltv >= LTV_WAD) return '∞';
  if (ltv <= 0n) return '1.00x';
  return `${formatMultiplierBps(multiplierBpsFromTargetLtv(ltvWadToBps(ltv)))}x`;
};

export function PositionLeverageSummary({ currentLtv, projectedLtv, lltv, hasChanges }: PositionLeverageSummaryProps): JSX.Element {
  const currentLeverage = formatLeverageFromLtv(currentLtv);
  const projectedLeverage = hasChanges ? formatLeverageFromLtv(projectedLtv) : currentLeverage;
  const projectedLtvForDisplay = hasChanges ? projectedLtv : currentLtv;

  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
        <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-secondary">Current</p>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-medium tabular-nums">{currentLeverage}</span>
          <span className={`text-xs tabular-nums ${getLTVColor(currentLtv, lltv)}`}>{formatLtvPercent(currentLtv)}% LTV</span>
        </div>
      </div>
      <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
        <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-secondary">Updated</p>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-medium tabular-nums">{projectedLeverage}</span>
          <span className={`text-xs tabular-nums ${getLTVColor(projectedLtvForDisplay, lltv)}`}>
            {formatLtvPercent(projectedLtvForDisplay)}% LTV
          </span>
        </div>
      </div>
    </div>
  );
}

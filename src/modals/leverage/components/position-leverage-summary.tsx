import { formatMultiplierBps, ltvWadToBps, multiplierBpsFromTargetLtv } from '@/hooks/leverage/math';
import { LTV_WAD } from '@/modals/borrow/components/helpers';
import { cn } from '@/utils/components';

type PositionLeverageSummaryProps = {
  currentLtv: bigint;
  projectedLtv: bigint;
  hasChanges: boolean;
};

const formatLeverageFromLtv = (ltv: bigint): string => {
  if (ltv >= LTV_WAD) return '∞';
  if (ltv <= 0n) return '1.00x';
  return `${formatMultiplierBps(multiplierBpsFromTargetLtv(ltvWadToBps(ltv)))}x`;
};

export function PositionLeverageSummary({ currentLtv, projectedLtv, hasChanges }: PositionLeverageSummaryProps): JSX.Element {
  const currentLeverage = formatLeverageFromLtv(currentLtv);
  const projectedLeverage = hasChanges ? formatLeverageFromLtv(projectedLtv) : currentLeverage;
  const cardClassName = 'rounded border px-3 py-2.5';
  const valueClassName = 'text-lg font-medium tabular-nums';

  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      <div className={cn(cardClassName, 'border-white/10 bg-hovered')}>
        <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-secondary">Current</p>
        <span className={valueClassName}>{currentLeverage}</span>
      </div>
      <div className={cn(cardClassName, hasChanges ? 'border-white/10 bg-hovered' : 'border-white/5 bg-hovered/40 text-secondary')}>
        <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-secondary">Updated</p>
        <span className={cn(valueClassName, !hasChanges && 'text-secondary')}>{projectedLeverage}</span>
      </div>
    </div>
  );
}

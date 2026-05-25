import Image from 'next/image';
import pharosIcon from '@/imgs/integrations/pharos-icon.png';
import type { AssetRiskEntry } from '@/hooks/queries/useAssetRiskQuery';

type PharosAssetRiskBadgeProps = {
  assetRisk?: AssetRiskEntry;
};

const formatScore = (score: number | null | undefined): string => {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return 'n/a';
  }

  return `${Math.round(score)}/100`;
};

const getGradeClassName = (grade: string): string => {
  if (grade === 'D' || grade === 'F') {
    return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300';
  }

  if (grade.startsWith('C')) {
    return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300';
  }

  return 'border-border bg-surface text-primary';
};

export function PharosAssetRiskBadge({ assetRisk }: PharosAssetRiskBadgeProps) {
  if (!assetRisk) {
    return null;
  }

  const grade = assetRisk.scores.overallGrade?.trim().toUpperCase() || '?';
  const recentlyDegraded = Boolean(assetRisk.scores.recentlyDegraded);
  const activeDepeg = assetRisk.peg.activeDepeg;
  const gradeChange =
    assetRisk.scores.previousOverallGrade && assetRisk.scores.overallGrade
      ? `${assetRisk.scores.previousOverallGrade} -> ${assetRisk.scores.overallGrade}`
      : null;

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums ${getGradeClassName(grade)}`}
        >
          {grade}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-zen text-xs text-primary">Asset risk</span>
            <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border border-border/60 bg-surface px-1.5 text-[10px] text-secondary">
              <Image
                src={pharosIcon}
                alt=""
                width={12}
                height={12}
                className="rounded-sm"
              />
              Pharos
            </span>
          </div>

          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-secondary">
            <span>Score {formatScore(assetRisk.scores.overallScore)}</span>
            <span>Liquidity {formatScore(assetRisk.scores.liquidityScore)}</span>
          </div>

          {(recentlyDegraded || activeDepeg) && (
            <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-secondary">
              {recentlyDegraded && <div>Recently downgraded{gradeChange ? ` ${gradeChange}` : ''}</div>}
              {activeDepeg && <div>Active depeg signal{assetRisk.peg.activeDepegBps ? ` ${assetRisk.peg.activeDepegBps} bps` : ''}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

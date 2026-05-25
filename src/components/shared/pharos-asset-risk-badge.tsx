import type { MouseEventHandler } from 'react';
import type { AssetRiskEntry } from '@/hooks/queries/useAssetRiskQuery';

type PharosAssetRiskBadgeProps = {
  assetRisk: AssetRiskEntry;
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

const formatScore = (score: number | null | undefined): string => {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return 'n/a';
  }

  return `${Math.round(score)}/100`;
};

const getGradeClassName = (grade: string): string => {
  if (grade.startsWith('F')) {
    return 'border-red-500/60 text-red-600 hover:border-red-500 dark:text-red-300';
  }

  if (grade.startsWith('D')) {
    return 'border-orange-500/60 text-orange-700 hover:border-orange-500 dark:text-orange-300';
  }

  if (grade.startsWith('C')) {
    return 'border-yellow-500/60 text-yellow-700 hover:border-yellow-500 dark:text-yellow-300';
  }

  if (grade.startsWith('A') || grade.startsWith('B')) {
    return 'border-emerald-500/60 text-emerald-700 hover:border-emerald-500 dark:text-emerald-300';
  }

  return 'border-border text-secondary hover:border-primary/30 hover:text-primary';
};

export const getPharosAssetUrl = (assetRisk?: AssetRiskEntry): string | null => {
  const assetId = assetRisk?.source?.assetId?.trim();

  return assetId ? `https://pharos.watch/stablecoin/${encodeURIComponent(assetId)}/` : null;
};

export function PharosAssetRiskBadge({ assetRisk, href, onClick }: PharosAssetRiskBadgeProps) {
  const grade = assetRisk.scores.overallGrade?.trim().toUpperCase() || '?';
  const recentlyDegraded = Boolean(assetRisk.scores.recentlyDegraded);
  const activeDepeg = assetRisk.peg.activeDepeg;
  const gradeChange =
    assetRisk.scores.previousOverallGrade && assetRisk.scores.overallGrade
      ? `${assetRisk.scores.previousOverallGrade} -> ${assetRisk.scores.overallGrade}`
      : null;
  const activeDepegText =
    activeDepeg && assetRisk.peg.activeDepegBps !== null && assetRisk.peg.activeDepegBps !== undefined
      ? `Active depeg ${assetRisk.peg.activeDepegBps} bps.`
      : activeDepeg
        ? 'Active depeg signal.'
        : '';
  const title = [
    `Pharos asset risk ${grade}.`,
    `Score ${formatScore(assetRisk.scores.overallScore)}.`,
    `Liquidity ${formatScore(assetRisk.scores.liquidityScore)}.`,
    recentlyDegraded ? `Recently downgraded${gradeChange ? ` ${gradeChange}` : ''}.` : '',
    activeDepegText,
    'Open Pharos.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border bg-surface px-1.5 font-zen text-xs font-normal leading-none no-underline transition-colors hover:no-underline focus:no-underline ${getGradeClassName(
        grade,
      )}`}
    >
      {grade}
    </a>
  );
}

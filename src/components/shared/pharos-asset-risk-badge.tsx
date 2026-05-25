import type { MouseEventHandler } from 'react';
import Image from 'next/image';
import pharosIcon from '@/imgs/integrations/pharos-icon.png';
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

const getGradeClassName = (grade: string, hasActiveDepeg: boolean, recentlyDegraded: boolean): string => {
  if (hasActiveDepeg || grade.startsWith('D') || grade.startsWith('F')) {
    return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 hover:border-red-500/50';
  }

  if (recentlyDegraded || grade.startsWith('C')) {
    return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:border-yellow-500/50';
  }

  return 'border-border bg-surface text-primary hover:border-primary/30';
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
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-1.5 text-[11px] font-semibold leading-none tabular-nums transition-colors ${getGradeClassName(
        grade,
        activeDepeg,
        recentlyDegraded,
      )}`}
    >
      <span>{grade}</span>
      <Image
        src={pharosIcon}
        alt=""
        width={13}
        height={13}
        className="rounded-sm opacity-80"
      />
    </a>
  );
}

import { Tooltip } from '@/components/ui/tooltip';
import { computeMarketWarnings } from '@/hooks/useMarketWarnings';
import type { Market } from '@/utils/types';

type RiskLevel = 'Low' | 'Medium' | 'High';

type SimplifiedRiskIndicatorProps = {
  market: Market;
};

const computeRiskLevel = (market: Market): { level: RiskLevel; description: string } => {
  const warnings = computeMarketWarnings(market, { considerWhitelist: true });

  const hasAlert = warnings.some((w) => w.level === 'alert');
  const hasWarning = warnings.some((w) => w.level === 'warning');

  if (hasAlert) {
    const alertWarnings = warnings.filter((w) => w.level === 'alert');
    return {
      level: 'High',
      description: alertWarnings.map((w) => w.description).join(', '),
    };
  }

  if (hasWarning) {
    const warningMessages = warnings.filter((w) => w.level === 'warning');
    return {
      level: 'Medium',
      description: warningMessages.map((w) => w.description).join(', '),
    };
  }

  return {
    level: 'Low',
    description: 'No significant risks detected',
  };
};

const getRiskStyles = (level: RiskLevel): { bg: string; text: string } => {
  switch (level) {
    case 'High':
      return { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' };
    case 'Medium':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' };
    case 'Low':
      return { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' };
    default:
      return { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' };
  }
};

export function SimplifiedRiskIndicator({ market }: SimplifiedRiskIndicatorProps) {
  const { level, description } = computeRiskLevel(market);
  const { bg, text } = getRiskStyles(level);

  return (
    <Tooltip content={<div className="max-w-xs text-xs">{description}</div>}>
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-normal ${bg} ${text}`}>{level}</span>
    </Tooltip>
  );
}

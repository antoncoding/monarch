import { Tooltip } from '@/components/ui/tooltip';
import { GrStatusGood } from 'react-icons/gr';
import { MdWarning, MdError } from 'react-icons/md';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useMarketWarnings } from '@/hooks/useMarketWarnings';
import type { WarningWithDetail, Market } from '@/utils/types';
import { WarningCategory } from '@/utils/types';

type RiskFlagProps = {
  level: 'green' | 'yellow' | 'red';
  description: string;
  mode?: 'simple' | 'complex';
  warningDetail?: WarningWithDetail;
};

const levelToIcon = (level: 'green' | 'yellow' | 'red') => {
  switch (level) {
    case 'green':
      return (
        <GrStatusGood
          size={18}
          className="text-green-600"
        />
      );
    case 'yellow':
      return (
        <MdWarning
          size={18}
          className="text-yellow-600"
        />
      );
    case 'red':
      return (
        <MdError
          size={18}
          className="text-red-600"
        />
      );
    default:
      return (
        <GrStatusGood
          size={18}
          className="text-green-600"
        />
      );
  }
};

const levelToStyle = (level: 'green' | 'yellow' | 'red') => {
  switch (level) {
    case 'green':
      return {
        text: 'text-green-700 dark:text-green-300',
        bar: 'bg-green-500',
      };
    case 'yellow':
      return {
        text: 'text-yellow-700 dark:text-yellow-300',
        bar: 'bg-yellow-500',
      };
    case 'red':
      return {
        text: 'text-red-700 dark:text-red-300',
        bar: 'bg-red-500',
      };
    default:
      return {
        text: 'text-green-700 dark:text-green-300',
        bar: 'bg-green-500',
      };
  }
};

export function RiskIndicator({ level, description, mode = 'simple', warningDetail }: RiskFlagProps) {
  const styles = levelToStyle(level);
  const icon = levelToIcon(level);

  const tooltipContent = (
    <TooltipContent
      icon={icon}
      title={description}
      detail={mode === 'complex' ? warningDetail?.description : undefined}
      className={styles.text}
    />
  );

  return (
    <Tooltip
      content={tooltipContent}
      className="max-w-[300px] rounded-sm"
    >
      <div className="gap flex">
        <div className={`h-4 w-[4px] ${styles.bar}`} />
      </div>
    </Tooltip>
  );
}

export function RiskIndicatorFromWarning({
  market,
  category,
  greenDescription,
  yellowDescription,
  redDescription,
  isBatched = false,
  mode = 'simple',
}: {
  market: Market;
  category: WarningCategory;
  greenDescription: string;
  yellowDescription: string;
  redDescription: string;
  isBatched?: boolean;
  mode?: 'simple' | 'complex';
}) {
  const warningsWithDetail = useMarketWarnings(market, true);
  const warnings = warningsWithDetail.filter((w) => w.category === category);

  if (warnings.length === 0) {
    return (
      <RiskIndicator
        level="green"
        description={greenDescription}
        mode={mode}
      />
    );
  }

  if (warnings.some((warning) => warning.level === 'alert')) {
    const alertWarning = warnings.find((w) => w.level === 'alert');
    return (
      <RiskIndicator
        level="red"
        description={isBatched ? `One or more markets have: ${redDescription}` : redDescription}
        mode={mode}
        warningDetail={alertWarning}
      />
    );
  }

  return (
    <RiskIndicator
      level="yellow"
      description={isBatched ? `One or more markets have: ${yellowDescription}` : yellowDescription}
      mode={mode}
      warningDetail={warnings[0]}
    />
  );
}

export function MarketAssetIndicator({
  market,
  isBatched = false,
  mode = 'simple',
}: {
  market: Market;
  isBatched?: boolean;
  mode?: 'simple' | 'complex';
}) {
  return (
    <RiskIndicatorFromWarning
      market={market}
      category={WarningCategory.asset}
      greenDescription="Recognized asset"
      yellowDescription="Asset with warning"
      redDescription="High-risk asset"
      isBatched={isBatched}
      mode={mode}
    />
  );
}

export function MarketOracleIndicator({
  market,
  isBatched = false,
  mode = 'simple',
}: {
  market: Market;
  isBatched?: boolean;
  mode?: 'simple' | 'complex';
}) {
  return (
    <RiskIndicatorFromWarning
      market={market}
      category={WarningCategory.oracle}
      greenDescription="Recognized oracles"
      yellowDescription="Oracle warning"
      redDescription="Oracle warning"
      isBatched={isBatched}
      mode={mode}
    />
  );
}

export function MarketStatusIndicator({
  market,
  isBatched = false,
  mode = 'simple',
}: {
  market: Market;
  isBatched?: boolean;
  mode?: 'simple' | 'complex';
}) {
  const warningsWithDetail = useMarketWarnings(market, true);

  // Combine debt + general category warnings
  const warnings = warningsWithDetail.filter((w) => w.category === WarningCategory.debt || w.category === WarningCategory.general);

  if (warnings.length === 0) {
    return (
      <RiskIndicator
        level="green"
        description="No market state warnings"
        mode={mode}
      />
    );
  }

  if (warnings.some((warning) => warning.level === 'alert')) {
    const alertWarning = warnings.find((w) => w.level === 'alert');
    return (
      <RiskIndicator
        level="red"
        description={isBatched ? 'One or more markets have warnings' : 'Market has critical warning'}
        mode={mode}
        warningDetail={alertWarning}
      />
    );
  }

  return (
    <RiskIndicator
      level="yellow"
      description={isBatched ? 'One or more markets have warnings' : 'Market has warning'}
      mode={mode}
      warningDetail={warnings[0]}
    />
  );
}

// Keep old name as alias for backward compatibility
export const MarketDebtIndicator = MarketStatusIndicator;

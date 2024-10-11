import { Tooltip } from '@nextui-org/tooltip';
import { Market, WarningWithDetail } from '@/utils/types';
import { WarningCategory } from '@/utils/types';

type RiskFlagProps = {
  level: 'green' | 'yellow' | 'red';
  description: string;
};

export function RiskIndicator({ level, description }: RiskFlagProps) {
  return (
    <Tooltip content={description}>
      <div className="gap flex">
        {level === 'green' && <div className="h-4 w-[4px] bg-green-500" />}
        {level === 'yellow' && <div className="h-4 w-[4px] bg-yellow-500" />}
        {level === 'red' && <div className="h-4 w-[4px] bg-red-500" />}
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
}: {
  market: { warningsWithDetail: WarningWithDetail[] };
  category: WarningCategory;
  greenDescription: string;
  yellowDescription: string;
  redDescription: string;
  isBatched?: boolean;
}) {
  const warnings = market.warningsWithDetail.filter((w) => w.category === category);
  if (warnings.length === 0) {
    return <RiskIndicator level="green" description={greenDescription} />;
  }
  if (warnings.some((warning) => warning.level === 'alert')) {
    return (
      <RiskIndicator
        level="red"
        description={isBatched ? `One or more markets have: ${redDescription}` : redDescription}
      />
    );
  } else
    return (
      <RiskIndicator
        level="yellow"
        description={
          isBatched ? `One or more markets have: ${yellowDescription}` : yellowDescription
        }
      />
    );
}

export function MarketAssetIndicator({
  market,
  isBatched = false,
}: {
  market: { warningsWithDetail: WarningWithDetail[] };
  isBatched?: boolean;
}) {
  return (
    <RiskIndicatorFromWarning
      market={market}
      category={WarningCategory.asset}
      greenDescription="Recognized assets"
      yellowDescription="Some warnings flagged with the assets"
      redDescription="Potentially dangerous assets"
      isBatched={isBatched}
    />
  );
}

export function MarketOracleIndicator({
  market,
  isBatched = false,
}: {
  market: { warningsWithDetail: WarningWithDetail[] };
  isBatched?: boolean;
}) {
  return (
    <RiskIndicatorFromWarning
      market={market}
      category={WarningCategory.oracle}
      greenDescription="Recognized oracles"
      yellowDescription="Some warnings flagged with the oracle"
      redDescription="Some alerts flagged with the oracle"
      isBatched={isBatched}
    />
  );
}

export function MarketDebtIndicator({
  market,
  isBatched = false,
}: {
  market: { warningsWithDetail: WarningWithDetail[] };
  isBatched?: boolean;
}) {
  return (
    <RiskIndicatorFromWarning
      market={market}
      category={WarningCategory.debt}
      greenDescription="No bad debt"
      yellowDescription="Bad debt has occurred"
      redDescription="Bad debt higher than 1% of supply"
      isBatched={isBatched}
    />
  );
}

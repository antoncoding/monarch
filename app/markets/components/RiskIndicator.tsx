import { Tooltip } from '@nextui-org/tooltip';
import { Market } from '@/hooks/useMarkets';
import { WarningCategory } from '@/utils/types';

type RiskFlagProps = {
  level: 'green' | 'yellow' | 'red';
  description: string;
};

export function RiskIndicator({ level, description }: RiskFlagProps) {
  return (
    <Tooltip content={description}>
      <div className="gap flex">
        {level === 'green' && <div className="h-4 w-2 bg-green-500" />}
        {level === 'yellow' && <div className="h-4 w-2 bg-yellow-500" />}
        {level === 'red' && <div className="h-4 w-2 bg-red-500" />}
      </div>
    </Tooltip>
  );
}

export function RiskIndicatorFromWarning({ market, category, greeDescription, yellowDescription, redDescription }: {
  market: Market;
  category: WarningCategory;
  greeDescription: string;
  yellowDescription: string;
  redDescription: string;
}) {
  const warnings = market.warningsWithDetail.filter((w) => w.category === category);
  if (warnings.length === 0) {
    return <RiskIndicator level="green" description={greeDescription} />;
  }
  if (warnings.some((warning) => warning.level === 'alert')) {
    return <RiskIndicator level="red" description={redDescription} />;
  } else return <RiskIndicator level="yellow" description={yellowDescription} />;

}

export function MarketAssetIndicator({ market }: { market: Market }) {
  return <RiskIndicatorFromWarning
    market={market}
    category={WarningCategory.asset}
    greeDescription="Recognized assets"
    yellowDescription="Some warning flagged with the assets"
    redDescription="Dangerous assets"
  />
}

export function MarketOracleIndicator({ market }: { market: Market }) {
  return <RiskIndicatorFromWarning
    market={market}
    category={WarningCategory.oracle}
    greeDescription="Recognized oracles"
    yellowDescription="Some warning flagged with the oracle"
    redDescription="Some alert flagged with the oracle"
  />
}

export function MarketDebtIndicator({ market }: { market: Market }) {
  return <RiskIndicatorFromWarning
    market={market}
    category={WarningCategory.debt}
    greeDescription="No bad debt"
    yellowDescription="Bad debt has occurred"
    redDescription="Bad debt higher than 1% of supply"
  />
}

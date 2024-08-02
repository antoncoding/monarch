import { Market } from '@/hooks/useMarkets';
import { WarningCategory } from '@/utils/types';
import { Tooltip } from '@nextui-org/tooltip';

type RiskFlagProps = {
  level: 'green' | 'yellow' | 'red';
  description: string;
};

export function MarketAssetIndicator({ market }: { market: Market }) {
    const { warningsWithDetail } = market;

    const warnings = warningsWithDetail.filter(w => w.category === WarningCategory.asset);
    
    if (warnings.length === 0) {
        return <RiskIndicator level="green" description={'Legit Assets'} />;
    }

    if (warnings.some((warning) => warning.level === 'alert')) {
        return <RiskIndicator level="red" description={'Dangerous assets'} />;
    }

    else return <RiskIndicator level="yellow" description={'Some warning flagged with the assets'} />;

}

export function MarketOracleIndicator({ market }: { market: Market }) {
    const { warningsWithDetail } = market;
    const warnings = warningsWithDetail.filter(w => w.category === WarningCategory.oracle);
    
    if (warnings.length === 0) {
        return <RiskIndicator level="green" description={'Oracle seems OK!'} />;
    }

    if (warnings.some((warning) => warning.level === 'alert')) {
        return <RiskIndicator level="red" description={'One or more warnings on oracle.'} />;
    }

    else return <RiskIndicator level="yellow" description={'One or more warnings on oracle.'} />;

}

export function MarketDebtIndicator({ market }: { market: Market }) {
    const { warningsWithDetail } = market;
    const warnings = warningsWithDetail.filter(w => w.category === WarningCategory.debt);

    if (warnings.length === 0) {
        return <RiskIndicator level="green" description={'No bad debt'} />;
    }
    if (warnings.some((warning) => warning.level === 'alert')) {
        return <RiskIndicator level="red" description={'Bad debt has occurred'} />;
    }

    else return <RiskIndicator level="yellow" description={'Bad debt higher than 1%'} />;
}

export function RiskIndicator({ level, description }: RiskFlagProps) {
  return (
    <Tooltip content={description}>
      <div className="gap flex">
        {level === 'green' && <div className="h-4 w-2 bg-green-500"></div>}
        {level === 'yellow' && <div className="h-4 w-2 bg-yellow-500"></div>}
        {level === 'red' && <div className="h-4 w-2 bg-red-500"></div>}
      </div>
    </Tooltip>
  );
}

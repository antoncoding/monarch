import type { Market } from '@/utils/types';
import { MarketAssetIndicator, MarketOracleIndicator, MarketStatusIndicator } from './risk-indicator';

type MarketRiskIndicatorsProps = {
  market: Market;
  isBatched?: boolean;
  mode?: 'simple' | 'complex';
};

/**
 * Standard risk indicators component showing asset, oracle, and debt risk tiers.
 * This component provides a consistent way to display market risk across the application.
 */
export function MarketRiskIndicators({ market, isBatched = false, mode = 'simple' }: MarketRiskIndicatorsProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      <MarketAssetIndicator
        market={market}
        isBatched={isBatched}
        mode={mode}
      />
      <MarketOracleIndicator
        market={market}
        isBatched={isBatched}
        mode={mode}
      />
      <MarketStatusIndicator
        market={market}
        isBatched={isBatched}
        mode={mode}
      />
    </div>
  );
}

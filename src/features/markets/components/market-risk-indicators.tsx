import type { Market } from '@/utils/types';
import { getMetricsKey, type MarketMetrics, useMarketMetricsMap } from '@/hooks/queries/useMarketMetricsQuery';
import { MarketAssetIndicator, MarketOracleIndicator, MarketStatusIndicator } from './risk-indicator';

type MarketRiskIndicatorsProps = {
  market: Market;
  marketMetrics?: MarketMetrics | null;
  isBatched?: boolean;
  mode?: 'simple' | 'complex';
};

/**
 * Standard risk indicators component showing asset, oracle, and debt risk tiers.
 * This component provides a consistent way to display market risk across the application.
 */
export function MarketRiskIndicators({ market, marketMetrics, isBatched = false, mode = 'simple' }: MarketRiskIndicatorsProps) {
  const shouldResolveMarketMetrics = marketMetrics === undefined;
  const { metricsMap } = useMarketMetricsMap({ enabled: shouldResolveMarketMetrics, defer: true });
  const resolvedMarketMetrics = marketMetrics ?? metricsMap.get(getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey)) ?? null;

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
        marketMetrics={resolvedMarketMetrics}
        isBatched={isBatched}
        mode={mode}
      />
    </div>
  );
}

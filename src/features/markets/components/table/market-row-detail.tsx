import { Info } from '@/components/Info/info';
import { EstimatedValueTooltip } from '@/components/shared/estimated-value-tooltip';
import { OracleTypeInfo } from '@/features/markets/components/oracle';
import type { MarketMetrics } from '@/hooks/queries/useMarketMetricsQuery';
import { useMarketWarnings } from '@/hooks/useMarketWarnings';
import { formatReadable } from '@/utils/balance';
import type { Market } from '@/utils/types';

type ExpandedMarketDetailProps = {
  market: Market;
  marketMetrics?: MarketMetrics | null;
};

const marketCreatedDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

function getMarketCreatedDisplay(createdAt: string | null | undefined) {
  if (!createdAt) {
    return null;
  }

  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const createdDate = new Date(timestamp);
  const ageDays = Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
  const ageLabel =
    ageDays < 1
      ? 'today'
      : ageDays < 30
        ? `${ageDays}d ago`
        : ageDays < 365
          ? `${Math.floor(ageDays / 30)}mo ago`
          : `${Math.floor(ageDays / 365)}y ago`;

  return `${marketCreatedDateFormatter.format(createdDate)} (${ageLabel})`;
}

export function ExpandedMarketDetail({ market, marketMetrics }: ExpandedMarketDetailProps) {
  const warningsWithDetail = useMarketWarnings(market);
  const marketCreatedDisplay = getMarketCreatedDisplay(marketMetrics?.marketCreatedAt);

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Oracle Info</p>
        </div>

        {/* contains: Oracle Info:    Standard (Custom...etc) */}
        <OracleTypeInfo
          oracleAddress={market.oracleAddress}
          chainId={market.morphoBlue.chain.id}
        />
      </div>

      {/* market info */}
      <div className="lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Market State</p>
        </div>
        <div className="mb-1 flex items-start justify-between">
          <p className="font-inter text-sm opacity-80">Available Liquidity</p>
          <p className="text-right font-zen text-sm">
            <EstimatedValueTooltip isEstimated={!market.hasUSDPrice}>
              {formatReadable(Number(market.state.liquidityAssetsUsd))}
            </EstimatedValueTooltip>
          </p>
        </div>
        <div className="mb-1 flex items-start justify-between">
          <p className="font-inter text-sm opacity-80">Utilization Rate</p>
          <p className="text-right font-zen text-sm">{formatReadable(Number(market.state.utilization * 100))}%</p>
        </div>
        {marketCreatedDisplay && (
          <div className="mb-1 flex items-start justify-between gap-3">
            <p className="font-inter text-sm opacity-80">Market Created</p>
            <p className="text-right font-zen text-sm">{marketCreatedDisplay}</p>
          </div>
        )}
      </div>

      {/* warnings */}
      <div className="lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Warnings</p>
        </div>

        <div className="flex flex-col gap-2">
          {warningsWithDetail.map((warning) => {
            return (
              <Info
                key={warning.code}
                description={warning.description}
                level={warning.level}
                title={' '}
              />
            );
          })}
        </div>
        {
          // if no warning
          warningsWithDetail.length === 0 && (
            <Info
              description="No warning flagged for this market!"
              level="success"
            />
          )
        }
      </div>
    </div>
  );
}

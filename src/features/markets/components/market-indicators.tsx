import { Tooltip } from '@/components/ui/tooltip';
import { FaRegLightbulb, FaShieldAlt } from 'react-icons/fa';
import { GoStarFill } from 'react-icons/go';
import { LuUser } from 'react-icons/lu';
import { IoWarningOutline } from 'react-icons/io5';
import { HiFire } from 'react-icons/hi2';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { CustomTagIcon } from '@/components/shared/custom-tag-icons';
import type { MarketDiscoveryCategory } from '@/features/markets/market-discovery';
import {
  getMetricsKey,
  useMarketMetricsMap,
  matchesCustomTag,
  type FlowTimeWindow,
  type MarketMetrics,
} from '@/hooks/queries/useMarketMetricsQuery';
import type { MarketDiscoveryFlag } from '@/hooks/queries/useMarketDiscoveryFlagsQuery';
import { useMarketWarnings } from '@/hooks/useMarketWarnings';
import { useMarketPreferences, type CustomTagConfig } from '@/stores/useMarketPreferences';
import type { Market } from '@/utils/types';
import { RewardsIndicator } from '@/features/markets/components/rewards-indicator';
import { getMarketPriceBadDebtWarning } from '@/features/markets/utils/market-price-debt-risk';

const ICON_SIZE = 14;

const WINDOW_LABELS: Record<FlowTimeWindow, string> = {
  '1h': '1 Hour',
  '24h': '24 Hours',
  '7d': '7 Days',
};

/**
 * Build tooltip detail showing actual flow values for configured thresholds
 */
function buildCustomTagDetail(
  config: CustomTagConfig,
  flows: Record<FlowTimeWindow, { supplyFlowPct?: number; borrowFlowUsd?: number }> | undefined,
  borrowUsd: number,
): string {
  if (!flows) return 'Matches your custom tag criteria';

  const parts: string[] = [];

  for (const [window, windowConfig] of Object.entries(config.windows)) {
    const supplyThreshold = windowConfig?.supplyFlowPct ?? '';
    const borrowThreshold = windowConfig?.borrowFlowPct ?? '';

    if (!supplyThreshold && !borrowThreshold) continue;

    const flow = flows[window as FlowTimeWindow];
    if (!flow) continue;

    const label = WINDOW_LABELS[window as FlowTimeWindow] ?? window;
    const actualSupply = flow.supplyFlowPct ?? 0;
    const actualBorrow = borrowUsd > 0 ? ((flow.borrowFlowUsd ?? 0) / borrowUsd) * 100 : 0;

    if (supplyThreshold && Number.isFinite(Number(supplyThreshold))) {
      const sign = actualSupply >= 0 ? '+' : '';
      parts.push(`${label}: ${sign}${actualSupply.toFixed(1)}% supply`);
    }
    if (borrowThreshold && Number.isFinite(Number(borrowThreshold))) {
      const sign = actualBorrow >= 0 ? '+' : '';
      parts.push(`${label}: ${sign}${actualBorrow.toFixed(1)}% borrow`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'Matches your custom tag criteria';
}

type MarketIndicatorsProps = {
  market: Market;
  marketMetrics?: MarketMetrics | null;
  discoveryFlags?: MarketDiscoveryFlag[];
  discoveryCategories?: Set<MarketDiscoveryCategory>;
  showRisk?: boolean;
  isStared?: boolean;
  hasUserPosition?: boolean;
};

export function MarketIndicators({
  market,
  marketMetrics,
  discoveryFlags = [],
  discoveryCategories,
  showRisk = false,
  isStared = false,
  hasUserPosition = false,
}: MarketIndicatorsProps) {
  const { showOfficialTrending, customTagConfig } = useMarketPreferences();
  const shouldResolveMarketMetrics = marketMetrics === undefined;
  const shouldLoadMetrics = shouldResolveMarketMetrics && (showOfficialTrending || customTagConfig.enabled || showRisk);
  const { metricsMap } = useMarketMetricsMap({ enabled: shouldLoadMetrics, defer: true });

  const marketKey = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);
  const metrics = marketMetrics ?? metricsMap.get(marketKey);
  const hasLiquidationProtection = Boolean(metrics?.everLiquidated);

  // Official trending (backend-computed)
  const isOfficialTrending = showOfficialTrending && Boolean(metrics?.isTrending);
  const isDiscoveryTrending = Boolean(discoveryCategories?.has('trending'));
  const trendingReason = metrics?.trendingReason;
  const newOpportunityFlag = discoveryCategories?.has('newOpportunities')
    ? discoveryFlags.find((flag) => flag.reasons.includes('recently_created') || flag.reasons.includes('newly_active'))
    : null;
  const popularFlag = discoveryCategories?.has('popular')
    ? discoveryFlags.find((flag) => flag.reasons.includes('individual_supplier_flow') || flag.reasons.includes('monarch_user_flow'))
    : null;
  const discoveryTrendingFlag = isDiscoveryTrending ? discoveryFlags.find((flag) => flag.reasons.includes('strong_recent_flow')) : null;

  // User's custom tag
  const hasCustomTag = customTagConfig.enabled && metrics ? matchesCustomTag(metrics, customTagConfig) : false;

  const marketWarnings = useMarketWarnings(showRisk ? market : null);
  const marketPriceBadDebtWarning = showRisk ? getMarketPriceBadDebtWarning(metrics) : null;
  const warnings = showRisk ? [...(marketPriceBadDebtWarning ? [marketPriceBadDebtWarning] : []), ...marketWarnings] : [];
  const hasWarnings = warnings.length > 0;
  const alertWarning = warnings.find((w) => w.level === 'alert');
  const warningLevel = alertWarning ? 'alert' : warnings.length > 0 ? 'warning' : null;

  return (
    <div className="flex items-center justify-center gap-2">
      {isStared && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <GoStarFill
                  size={ICON_SIZE}
                  className="text-yellow-500"
                />
              }
              detail="You have starred this market"
            />
          }
        >
          <div className="flex-shrink-0">
            <GoStarFill
              size={ICON_SIZE}
              className="text-yellow-500"
            />
          </div>
        </Tooltip>
      )}

      {hasUserPosition && (
        <Tooltip
          content={
            <TooltipContent
              icon={<LuUser size={ICON_SIZE} />}
              detail="You have supplied to this market"
            />
          }
        >
          <div className="flex-shrink-0">
            <LuUser size={ICON_SIZE} />
          </div>
        </Tooltip>
      )}

      {hasLiquidationProtection && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <FaShieldAlt
                  size={ICON_SIZE}
                  className="text-primary text-opacity-50"
                />
              }
              detail="This market has on-chain liquidation events performed by liquidation bots"
            />
          }
        >
          <div className="flex-shrink-0">
            <FaShieldAlt
              size={ICON_SIZE}
              className="text-primary text-opacity-50"
            />
          </div>
        </Tooltip>
      )}

      <RewardsIndicator
        size={ICON_SIZE}
        chainId={market.morphoBlue.chain.id}
        marketId={market.uniqueKey}
        loanTokenAddress={market.loanAsset.address}
        whitelisted={market.whitelisted}
      />

      {newOpportunityFlag && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <FaRegLightbulb
                  size={ICON_SIZE}
                  className="text-orange-500"
                />
              }
              title="New opportunity"
              detail={newOpportunityFlag.summary}
            />
          }
        >
          <div className="flex-shrink-0">
            <FaRegLightbulb
              size={ICON_SIZE}
              className="text-orange-500"
            />
          </div>
        </Tooltip>
      )}

      {/* Backend-computed trending */}
      {(isOfficialTrending || isDiscoveryTrending) && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <HiFire
                  size={ICON_SIZE}
                  className="text-orange-500"
                />
              }
              title="Trending"
              detail={discoveryTrendingFlag?.summary ?? trendingReason ?? 'This market is trending based on flow activity'}
            />
          }
        >
          <div className="flex-shrink-0">
            <HiFire
              size={ICON_SIZE}
              className="text-orange-500"
            />
          </div>
        </Tooltip>
      )}

      {popularFlag && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <LuUser
                  size={ICON_SIZE}
                  className="text-orange-500"
                />
              }
              title="Popular"
              detail={popularFlag.summary}
            />
          }
        >
          <div className="flex-shrink-0">
            <LuUser
              size={ICON_SIZE}
              className="text-orange-500"
            />
          </div>
        </Tooltip>
      )}

      {/* User's Custom Tag */}
      {hasCustomTag &&
        (() => {
          const tooltipDetail = buildCustomTagDetail(customTagConfig, metrics?.flows, metrics?.currentState?.borrowUsd ?? 0);
          return (
            <Tooltip
              content={
                <TooltipContent
                  icon={
                    <CustomTagIcon
                      iconId={customTagConfig.icon}
                      size={ICON_SIZE}
                      className="text-primary"
                    />
                  }
                  title="Custom Tag"
                  detail={tooltipDetail}
                />
              }
            >
              <div className="flex-shrink-0 text-primary">
                <CustomTagIcon
                  iconId={customTagConfig.icon}
                  size={ICON_SIZE}
                />
              </div>
            </Tooltip>
          );
        })()}

      {showRisk && hasWarnings && (
        <Tooltip
          content={
            <TooltipContent
              title={warningLevel === 'alert' ? 'High Risk' : 'Warning'}
              detail={alertWarning?.description ?? warnings[0]?.description ?? 'Market has warnings'}
            />
          }
        >
          <div className="flex-shrink-0">
            <IoWarningOutline
              size={ICON_SIZE}
              className={warningLevel === 'alert' ? 'text-red-500' : 'text-yellow-500'}
            />
          </div>
        </Tooltip>
      )}
    </div>
  );
}

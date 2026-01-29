import { Tooltip } from '@/components/ui/tooltip';
import { FaShieldAlt } from 'react-icons/fa';
import { GoStarFill } from 'react-icons/go';
import { LuUser } from 'react-icons/lu';
import { IoWarningOutline } from 'react-icons/io5';
import { AiOutlineFire } from 'react-icons/ai';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useTrendingMarketKeys, useCustomSignalMarketKeys, getMetricsKey, useEverLiquidated, useMarketMetricsMap } from '@/hooks/queries/useMarketMetricsQuery';
import { computeMarketWarnings } from '@/hooks/useMarketWarnings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import type { Market } from '@/utils/types';
import { RewardsIndicator } from '@/features/markets/components/rewards-indicator';

const ICON_SIZE = 14;

type MarketIndicatorsProps = {
  market: Market;
  showRisk?: boolean;
  isStared?: boolean;
  hasUserPosition?: boolean;
};

export function MarketIndicators({ market, showRisk = false, isStared = false, hasUserPosition = false }: MarketIndicatorsProps) {
  const hasLiquidationProtection = useEverLiquidated(market.morphoBlue.chain.id, market.uniqueKey);
  const { trendingConfig } = useMarketPreferences();
  const { metricsMap } = useMarketMetricsMap();

  // Backend-computed trending (official "hot markets")
  const trendingKeys = useTrendingMarketKeys();
  const marketKey = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);
  const isTrending = trendingKeys.has(marketKey);
  const trendingReason = metricsMap.get(marketKey)?.trendingReason;

  // User's custom tag
  const customTagKeys = useCustomSignalMarketKeys();
  const hasCustomTag = trendingConfig.enabled && customTagKeys.has(marketKey);
  const warnings = showRisk ? computeMarketWarnings(market, true) : [];
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

      {/* Backend-computed trending (official) */}
      {isTrending && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <AiOutlineFire
                  size={ICON_SIZE + 2}
                  className="text-orange-500"
                />
              }
              detail={trendingReason ?? 'This market is trending'}
            />
          }
        >
          <div className="flex-shrink-0">
            <AiOutlineFire
              size={ICON_SIZE + 2}
              className="text-orange-500"
            />
          </div>
        </Tooltip>
      )}

      {/* User's custom tag */}
      {hasCustomTag && (
        <Tooltip
          content={
            <TooltipContent
              icon={<span className="text-base">{trendingConfig.icon}</span>}
              detail="Matches your custom tag criteria"
            />
          }
        >
          <div className="flex-shrink-0 text-base">
            {trendingConfig.icon}
          </div>
        </Tooltip>
      )}

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

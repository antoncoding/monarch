import { Tooltip } from '@/components/ui/tooltip';
import { FaShieldAlt, FaStar, FaUser } from 'react-icons/fa';
import { FiAlertCircle } from 'react-icons/fi';
import { AiOutlineFire } from 'react-icons/ai';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useTrendingMarketKeys, getMetricsKey, useEverLiquidated } from '@/hooks/queries/useMarketMetricsQuery';
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
  // Check liquidation protection status (uses Monarch Metrics API with fallback)
  const hasLiquidationProtection = useEverLiquidated(market.morphoBlue.chain.id, market.uniqueKey);

  // Check trending status
  const { trendingConfig } = useMarketPreferences();
  const trendingKeys = useTrendingMarketKeys();
  const isTrending = trendingConfig.enabled && trendingKeys.has(getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey));

  // Compute risk warnings if needed
  const warnings = showRisk ? computeMarketWarnings(market, true) : [];
  const hasWarnings = warnings.length > 0;
  const alertWarning = warnings.find((w) => w.level === 'alert');
  const warningLevel = alertWarning ? 'alert' : warnings.length > 0 ? 'warning' : null;

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Personal Indicators */}
      {isStared && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <FaStar
                  size={ICON_SIZE}
                  className="text-yellow-500"
                />
              }
              detail="You have starred this market"
            />
          }
        >
          <div className="flex-shrink-0">
            <FaStar
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
              icon={<FaUser size={ICON_SIZE} />}
              detail="You have supplied to this market"
            />
          }
        >
          <div className="flex-shrink-0">
            <FaUser size={ICON_SIZE} />
          </div>
        </Tooltip>
      )}

      {/* Universal Indicators */}
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

      {/* {market.isMonarchWhitelisted && (
        <Tooltip          content={
            <TooltipContent
              icon={<Image src={logo} alt="Monarch" width={ICON_SIZE} height={ICON_SIZE} />}
              detail="This market is recognized by Monarch"
            />
          }
        >
          <div className="flex-shrink-0">
            <Image src={logo} alt="Monarch" width={ICON_SIZE} height={ICON_SIZE} />
          </div>
        </Tooltip>
      )} */}

      <RewardsIndicator
        size={ICON_SIZE}
        chainId={market.morphoBlue.chain.id}
        marketId={market.uniqueKey}
        loanTokenAddress={market.loanAsset.address}
        whitelisted={market.whitelisted}
      />

      {/* Trending Indicator */}
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
              detail="This market is trending based on flow metrics"
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

      {/* Risk Warnings */}
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
            <FiAlertCircle
              size={ICON_SIZE}
              className={warningLevel === 'alert' ? 'text-red-500' : 'text-yellow-500'}
            />
          </div>
        </Tooltip>
      )}
    </div>
  );
}

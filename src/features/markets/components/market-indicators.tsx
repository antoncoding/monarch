import { Tooltip } from '@/components/ui/tooltip';
import { FaShieldAlt } from 'react-icons/fa';
import { GoStarFill } from 'react-icons/go';
import { LuUser } from 'react-icons/lu';
import { IoWarningOutline } from 'react-icons/io5';
import { AiOutlineFire } from 'react-icons/ai';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { CustomTagIcon } from '@/components/shared/custom-tag-icons';
import {
  useOfficialTrendingMarketKeys,
  useCustomTagMarketKeys,
  getMetricsKey,
  useEverLiquidated,
  useMarketMetricsMap,
} from '@/hooks/queries/useMarketMetricsQuery';
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
  const { showOfficialTrending, customTagConfig } = useMarketPreferences();
  const { metricsMap } = useMarketMetricsMap();

  const marketKey = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);

  // Official trending (backend-computed)
  const officialTrendingKeys = useOfficialTrendingMarketKeys();
  const isOfficialTrending = showOfficialTrending && officialTrendingKeys.has(marketKey);
  const trendingReason = metricsMap.get(marketKey)?.trendingReason;

  // User's custom tag
  const customTagKeys = useCustomTagMarketKeys();
  const hasCustomTag = customTagConfig.enabled && customTagKeys.has(marketKey);

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

      {/* Official Trending (backend-computed) */}
      {isOfficialTrending && (
        <Tooltip
          content={
            <TooltipContent
              icon={
                <AiOutlineFire
                  size={ICON_SIZE}
                  className="text-orange-500"
                />
              }
              title="Trending"
              detail={trendingReason ?? 'This market is trending based on flow activity'}
            />
          }
        >
          <div className="flex-shrink-0">
            <AiOutlineFire
              size={ICON_SIZE}
              className="text-orange-500"
            />
          </div>
        </Tooltip>
      )}

      {/* User's Custom Tag */}
      {hasCustomTag && (
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
              detail="Matches your custom tag criteria"
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

import React from 'react';
import { Tooltip } from '@heroui/react';
import { FaShieldAlt, FaStar, FaUser } from 'react-icons/fa';
import { FiAlertCircle } from 'react-icons/fi';
import { TooltipContent } from '@/components/TooltipContent';
import { useLiquidationsContext } from '@/contexts/LiquidationsContext';
import { computeMarketWarnings } from '@/hooks/useMarketWarnings';
import { Market } from '@/utils/types';
import { RewardsIndicator } from 'app/markets/components/RewardsIndicator';

const ICON_SIZE = 14;

type MarketIndicatorsProps = {
  market: Market;
  showRisk?: boolean;
  isStared?: boolean;
  hasUserPosition?: boolean;
};

export function MarketIndicators({
  market,
  showRisk = false,
  isStared = false,
  hasUserPosition = false,
}: MarketIndicatorsProps) {
  // Check liquidation protection status on-demand (like Merkl rewards pattern)
  const { isProtectedByLiquidationBots } = useLiquidationsContext();
  const hasLiquidationProtection = isProtectedByLiquidationBots(market.uniqueKey);

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
          classNames={{
            base: 'p-0 m-0 bg-transparent shadow-sm border-none',
            content: 'p-0 m-0 bg-transparent shadow-sm border-none',
          }}
          content={
            <TooltipContent
              icon={<FaStar size={ICON_SIZE} className="text-yellow-500" />}
              detail="You have starred this market"
            />
          }
        >
          <div className="flex-shrink-0">
            <FaStar size={ICON_SIZE} className="text-yellow-500" />
          </div>
        </Tooltip>
      )}

      {hasUserPosition && (
        <Tooltip
          classNames={{
            base: 'p-0 m-0 bg-transparent shadow-sm border-none',
            content: 'p-0 m-0 bg-transparent shadow-sm border-none',
          }}
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
          classNames={{
            base: 'p-0 m-0 bg-transparent shadow-sm border-none',
            content: 'p-0 m-0 bg-transparent shadow-sm border-none',
          }}
          content={
            <TooltipContent
              icon={<FaShieldAlt size={ICON_SIZE} className="text-primary text-opacity-50" />}
              detail="This market has on-chain liquidation events performed by liquidation bots"
            />
          }
        >
          <div className="flex-shrink-0">
            <FaShieldAlt size={ICON_SIZE} className="text-primary text-opacity-50" />
          </div>
        </Tooltip>
      )}

      {/* {market.isMonarchWhitelisted && (
        <Tooltip
          classNames={{
            base: 'p-0 m-0 bg-transparent shadow-sm border-none',
            content: 'p-0 m-0 bg-transparent shadow-sm border-none',
          }}
          content={
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
        whitelisted={market.whitelisted && !market.isMonarchWhitelisted}
      />

      {/* Risk Warnings */}
      {showRisk && hasWarnings && (
        <Tooltip
          classNames={{
            base: 'p-0 m-0 bg-transparent shadow-sm border-none',
            content: 'p-0 m-0 bg-transparent shadow-sm border-none',
          }}
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

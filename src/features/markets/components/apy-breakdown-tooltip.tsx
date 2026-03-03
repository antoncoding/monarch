import type React from 'react';
import { RiSparklingFill } from 'react-icons/ri';
import { Tooltip } from '@/components/ui/tooltip';
import { TokenIcon } from '@/components/shared/token-icon';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import type { SimplifiedCampaign } from '@/utils/merklTypes';
import { convertAprToApy, convertApyToApr } from '@/utils/rateMath';
import type { Market } from '@/utils/types';

type RateMode = 'supply' | 'borrow';

type APYBreakdownTooltipProps = {
  baseAPY: number;
  activeCampaigns: SimplifiedCampaign[];
  children: React.ReactNode;
  mode?: RateMode;
};

type APYCellProps = {
  market: Market;
  mode?: RateMode;
};

const modeByType: Record<string, RateMode | null> = {
  MORPHOSUPPLY: 'supply',
  MORPHOSUPPLY_SINGLETOKEN: 'supply',
  MORPHOBORROW: 'borrow',
};

const getCampaignMode = (campaign: SimplifiedCampaign): RateMode | null => {
  const directMode = modeByType[campaign.type];
  if (directMode) return directMode;

  if (campaign.type !== 'MULTILENDBORROW') return null;

  const action = campaign.opportunityAction?.toUpperCase();
  if (action === 'LEND') return 'supply';
  if (action === 'BORROW') return 'borrow';

  const name = campaign.name?.toLowerCase() ?? '';
  if (name.includes('borrow')) return 'borrow';
  if (name.includes('supply') || name.includes('lend')) return 'supply';

  return null;
};

const filterCampaignsByMode = (campaigns: SimplifiedCampaign[], mode: RateMode): SimplifiedCampaign[] => {
  return campaigns.filter((campaign) => getCampaignMode(campaign) === mode);
};

const getFullRate = (baseRate: number, rewardTotal: number, mode: RateMode): number => {
  return mode === 'borrow' ? baseRate - rewardTotal : baseRate + rewardTotal;
};

const getRewardRatePrefix = (mode: RateMode): string => {
  return mode === 'borrow' ? '-' : '+';
};

const getDisplayRewardRate = (rewardAprPercent: number, isAprDisplay: boolean): number => {
  if (isAprDisplay) return rewardAprPercent;
  return convertAprToApy(rewardAprPercent / 100) * 100;
};

export function APYBreakdownTooltip({ baseAPY, activeCampaigns, children, mode = 'supply' }: APYBreakdownTooltipProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const modeLabel = mode === 'borrow' ? 'Borrow' : 'Supply';

  // Convert base rate if APR display is enabled
  // Note: baseAPY is already a percentage (not decimal), so we need to convert it
  const baseRateValue = isAprDisplay ? convertApyToApr(baseAPY / 100) * 100 : baseAPY;

  const rewardTotal = activeCampaigns.reduce((sum, campaign) => {
    return sum + getDisplayRewardRate(campaign.apr, isAprDisplay);
  }, 0);
  const totalRate = getFullRate(baseRateValue, rewardTotal, mode);
  const rewardPrefix = getRewardRatePrefix(mode);

  const content = (
    <div className="bg-surface flex flex-col rounded-sm p-4 lg:min-w-[200px]">
      <div className="mb-2 px-1 font-bold text-primary">
        {modeLabel} {rateLabel} Breakdown
      </div>
      <div className="space-y-3 p-1">
        <div className="flex items-center justify-between text-xs">
          <span>Base {modeLabel} {rateLabel}</span>
          <span className="ml-6">{baseRateValue.toFixed(2)}%</span>
        </div>
        {activeCampaigns.map((campaign, index) => {
          const rewardRateValue = getDisplayRewardRate(campaign.apr, isAprDisplay);
          return (
            <div
              key={index}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span>{campaign.rewardToken.symbol}</span>
                <TokenIcon
                  address={campaign.rewardToken.address}
                  chainId={campaign.chainId}
                  symbol={campaign.rewardToken.symbol}
                  width={14}
                  height={14}
                />
              </div>
              <span className="ml-6">
                {rewardPrefix}
                {rewardRateValue.toFixed(2)}%
              </span>
            </div>
          );
        })}
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
          <div className="flex items-center justify-between text-xs">
            <span>Net {modeLabel} {rateLabel}</span>
            <span className="ml-6">{totalRate.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );

  return <Tooltip content={content}>{children}</Tooltip>;
}

export function APYCell({ market, mode = 'supply' }: APYCellProps) {
  const { showFullRewardAPY, isAprDisplay } = useAppSettings();
  const { activeCampaigns } = useMarketCampaigns({
    marketId: market.uniqueKey,
    loanTokenAddress: market.loanAsset.address,
    chainId: market.morphoBlue.chain.id,
    whitelisted: market.whitelisted,
  });

  const baseApyDecimal = mode === 'borrow' ? market.state.borrowApy : market.state.supplyApy;
  const baseAPY = baseApyDecimal * 100;
  const relevantCampaigns = filterCampaignsByMode(activeCampaigns, mode);
  const hasModeRewards = relevantCampaigns.length > 0;
  const extraRewards = hasModeRewards
    ? relevantCampaigns.reduce((sum, campaign) => {
      return sum + getDisplayRewardRate(campaign.apr, isAprDisplay);
    }, 0)
    : 0;

  // Convert base rate if APR display is enabled
  const baseRate = isAprDisplay ? convertApyToApr(baseApyDecimal) * 100 : baseAPY;

  // Net rate: suppliers earn rewards, borrowers are offset by rewards.
  const fullRate = getFullRate(baseRate, extraRewards, mode);
  const showRewardsInline = showFullRewardAPY && hasModeRewards;
  const displayRate = showRewardsInline ? fullRate : baseRate;

  const rateDisplay = (
    <span className="inline-flex items-center gap-1">
      <span>{displayRate.toFixed(2)}%</span>
      {showRewardsInline && (
        <RiSparklingFill
          className="h-3 w-3"
          color={MONARCH_PRIMARY}
        />
      )}
    </span>
  );

  if (hasModeRewards) {
    return (
      <APYBreakdownTooltip
        baseAPY={baseAPY}
        activeCampaigns={relevantCampaigns}
        mode={mode}
      >
        <span className="cursor-help">{rateDisplay}</span>
      </APYBreakdownTooltip>
    );
  }

  return rateDisplay;
}

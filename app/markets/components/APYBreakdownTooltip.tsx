import React from 'react';
import { Tooltip } from '@heroui/react';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { useMarkets } from '@/hooks/useMarkets';
import { SimplifiedCampaign } from '@/utils/merklTypes';
import { Market } from '@/utils/types';

type APYBreakdownTooltipProps = {
  baseAPY: number;
  activeCampaigns: SimplifiedCampaign[];
  fullAPY: number;
  children: React.ReactNode;
};

type APYCellProps = {
  market: Market;
};

export function APYBreakdownTooltip({
  baseAPY,
  activeCampaigns,
  fullAPY,
  children,
}: APYBreakdownTooltipProps) {
  const content = (
    <div className="bg-surface flex flex-col rounded-sm p-4 lg:min-w-[200px]">
      <div className="mb-2 px-1 font-bold text-primary">APY Breakdown</div>
      <div className="space-y-3 p-1">
        <div className="flex items-center justify-between text-xs">
          <span>Base APY</span>
          <span className="ml-6">{baseAPY.toFixed(2)}%</span>
        </div>
        {activeCampaigns.map((campaign, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
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
            <span className="ml-6">{campaign.apr.toFixed(2)}%</span>
          </div>
        ))}
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
          <div className="flex items-center justify-between text-xs">
            <span>Total</span>
            <span className="ml-6">{fullAPY.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={content}
    >
      {children}
    </Tooltip>
  );
}

export function APYCell({ market }: APYCellProps) {
  const { showFullRewardAPY } = useMarkets();
  const { activeCampaigns, hasActiveRewards } = useMarketCampaigns({
    marketId: market.uniqueKey,
    loanTokenAddress: market.loanAsset.address,
    chainId: market.morphoBlue.chain.id,
    whitelisted: market.whitelisted && !market.isMonarchWhitelisted
  });

  const baseAPY = market.state.supplyApy * 100;
  const extraRewards = hasActiveRewards
    ? activeCampaigns.reduce((sum, campaign) => sum + campaign.apr, 0)
    : 0;
  const fullAPY = baseAPY + extraRewards;

  const displayAPY = showFullRewardAPY && hasActiveRewards ? fullAPY : baseAPY;

  if (hasActiveRewards) {
    return (
      <APYBreakdownTooltip baseAPY={baseAPY} activeCampaigns={activeCampaigns} fullAPY={fullAPY}>
        <span className="cursor-help">{displayAPY.toFixed(2)}%</span>
      </APYBreakdownTooltip>
    );
  }

  return <span>{displayAPY.toFixed(2)}%</span>;
}

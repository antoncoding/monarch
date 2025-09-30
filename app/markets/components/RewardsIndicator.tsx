import React from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { FiGift } from 'react-icons/fi';
import { TooltipContent } from '@/components/TooltipContent';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import merklLogo from '@/imgs/merkl.jpg';

type RewardsIndicatorProps = {
  chainId: number;
  marketId: string;
  loanTokenAddress?: string;
  whitelisted: boolean // whitelisted by morpho
};

export function RewardsIndicator({ marketId, chainId, loanTokenAddress, whitelisted }: RewardsIndicatorProps) {
  const { activeCampaigns, hasActiveRewards, loading } = useMarketCampaigns({ 
    marketId, 
    loanTokenAddress, 
    chainId,
    whitelisted
  });

  if (loading || !hasActiveRewards) {
    return null;
  }

  // Create tooltip detail with all rewards
  const rewardsList = activeCampaigns
    .map((campaign) => {
      const rewardType =
        campaign.type === 'MORPHOSUPPLY' || campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
          ? 'supplier'
          : 'borrower';
      return `${campaign.rewardToken.symbol} ${rewardType} reward +${campaign.apr.toFixed(2)}%`;
    })
    .join('\n');

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
        <TooltipContent
          icon={
            <Image src={merklLogo} alt="Merkl" width={24} height={24} className="rounded-full" />
          }
          title="External Rewards"
          detail={rewardsList}
        />
      }
    >
      <div>
        <FiGift size={16} />
      </div>
    </Tooltip>
  );
}

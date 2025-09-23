import React from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { FiGift } from 'react-icons/fi';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import merklLogo from '@/imgs/merkl.jpg';

type RewardsIndicatorProps = {
  chainId: number;
  marketId: string;
};

export function RewardsIndicator({ marketId }: RewardsIndicatorProps) {
  const { activeCampaigns, hasActiveRewards, loading } = useMarketCampaigns(marketId);

  if (loading || !hasActiveRewards) {
    return null;
  }

  // Create tooltip detail with all rewards
  const rewardsList = activeCampaigns.map(campaign => {
    const rewardType = campaign.type === 'MORPHOSUPPLY' ? 'supplier' : 'borrower';
    return `${campaign.rewardToken.symbol} ${rewardType} reward +${campaign.apr.toFixed(2)}%`;
  }).join('\n');

  return (
    <Tooltip
      content={
        <div className="flex items-center gap-2 p-2">
          <Image
            src={merklLogo}
            alt="Merkl"
            width={24}
            height={24}
            className="rounded-full"
          />
          <div>
            <div className="font-medium text-sm">External Rewards</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line">
              {rewardsList}
            </div>
          </div>
        </div>
      }
    >
      <div>
        <FiGift size={16} />
      </div>
    </Tooltip>
  );
}
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { FiGift } from 'react-icons/fi';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import merklLogo from '@/imgs/merkl.jpg';

type RewardsIndicatorProps = {
  size: number;
  chainId: number;
  marketId: string;
  loanTokenAddress?: string;
  whitelisted: boolean; // whitelisted by morpho
};

export function RewardsIndicator({ marketId, chainId, loanTokenAddress, whitelisted, size }: RewardsIndicatorProps) {
  const { activeCampaigns, hasActiveRewards, loading } = useMarketCampaigns({
    marketId,
    loanTokenAddress,
    chainId,
    whitelisted,
  });

  if (loading || !hasActiveRewards) {
    return null;
  }

  // Create tooltip detail with all rewards
  const rewardsList = activeCampaigns
    .map((campaign) => {
      const rewardType = campaign.type === 'MORPHOBORROW' ? 'borrower' : 'supplier';
      return `${campaign.rewardToken.symbol} ${rewardType} reward +${campaign.apr.toFixed(2)}%`;
    })
    .join('\n');

  return (
    <Tooltip
      content={
        <TooltipContent
          icon={
            <Image
              src={merklLogo}
              alt="Merkl"
              width={24}
              height={24}
              className="rounded-full"
            />
          }
          title="External Rewards"
          detail={rewardsList}
        />
      }
    >
      <div>
        <FiGift size={size} />
      </div>
    </Tooltip>
  );
}

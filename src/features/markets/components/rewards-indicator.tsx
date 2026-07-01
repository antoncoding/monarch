import { Tooltip } from '@/components/ui/tooltip';
import { FiGift } from 'react-icons/fi';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { isBorrowCampaign } from '@/utils/merklApi';

type RewardsIndicatorProps = {
  size: number;
  chainId: number;
  marketId: string;
  loanTokenAddress?: string;
  whitelisted: boolean; // whitelisted by morpho
};

type RewardSide = 'supplier' | 'borrower';

const REWARD_SIDES: RewardSide[] = ['supplier', 'borrower'];

const REWARD_SIDE_CONFIG: Record<RewardSide, { letter: string; label: string; badgeClassName: string }> = {
  supplier: {
    letter: 'S',
    label: 'Supplier rewards',
    badgeClassName: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
  },
  borrower: {
    letter: 'B',
    label: 'Borrower rewards',
    badgeClassName: 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300',
  },
};

function RewardSideIcon({ side, size }: { side: RewardSide; size: number }) {
  const config = REWARD_SIDE_CONFIG[side];
  const badgeSize = Math.max(10, Math.round(size * 0.8));
  const fontSize = Math.max(8, Math.round(size * 0.5));

  return (
    <span
      role="img"
      aria-label={config.label}
      className="relative inline-flex shrink-0 items-center justify-center text-primary"
      style={{ width: size + badgeSize / 2, height: size + badgeSize / 3 }}
    >
      <FiGift
        size={size}
        aria-hidden="true"
      />
      <span
        className={`absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full border border-background font-monospace font-medium ${config.badgeClassName}`}
        style={{
          width: badgeSize,
          height: badgeSize,
          fontSize,
          lineHeight: `${badgeSize}px`,
        }}
        aria-hidden="true"
      >
        {config.letter}
      </span>
    </span>
  );
}

function getRewardSide(campaign: Parameters<typeof isBorrowCampaign>[0]): RewardSide {
  return isBorrowCampaign(campaign) ? 'borrower' : 'supplier';
}

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

  const rewardsList = activeCampaigns
    .map((campaign) => {
      const rewardSide = getRewardSide(campaign);
      const rewardSign = rewardSide === 'borrower' ? '-' : '+';
      const rewardLabel = rewardSide === 'borrower' ? 'borrow APR offset' : 'supplier reward';
      return `${campaign.rewardToken.symbol} ${rewardLabel} ${rewardSign}${campaign.apr.toFixed(2)}%`;
    })
    .join('\n');
  const rewardSides = REWARD_SIDES.filter((side) => activeCampaigns.some((campaign) => getRewardSide(campaign) === side));

  return (
    <Tooltip
      content={
        <TooltipContent
          icon={
            <span className="inline-flex items-center gap-1">
              {rewardSides.map((side) => (
                <RewardSideIcon
                  key={side}
                  side={side}
                  size={16}
                />
              ))}
            </span>
          }
          title="External Rewards"
          detail={rewardsList}
        />
      }
    >
      <div className="flex shrink-0 items-center gap-1">
        {rewardSides.map((side) => (
          <RewardSideIcon
            key={side}
            side={side}
            size={size}
          />
        ))}
      </div>
    </Tooltip>
  );
}

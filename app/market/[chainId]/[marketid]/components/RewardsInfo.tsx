import React from 'react';
import { Tooltip } from '@heroui/react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { FaGift } from 'react-icons/fa';
import { TooltipContent } from '@/components/TooltipContent';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { getMerklCampaignURL } from '@/utils/external';
import { SimplifiedCampaign } from '@/utils/merklTypes';

type RewardsInfoProps = {
  marketId: string;
  loanTokenAddress?: string;
  chainId?: number;
};

function RewardCampaignRow({ campaign }: { campaign: SimplifiedCampaign }) {
  // For SINGLETOKEN campaigns, use the campaignId directly, for others use first 42 chars of marketId
  const urlIdentifier = campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
    ? campaign.campaignId
    : campaign.marketId.slice(0, 42);
  const merklUrl = getMerklCampaignURL(campaign.chainId, campaign.type, urlIdentifier);

  const actionType = campaign.type === 'MORPHOSUPPLY' || campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
    ? 'suppliers' : 'borrowers';
  const actionVerb = campaign.type === 'MORPHOSUPPLY' || campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
    ? 'supply' : 'borrow';

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
        <TooltipContent
          icon={<FaGift className="text-green-500" />}
          title="External Rewards Program"
          detail={`There are extra incentives for all ${actionType} who ${actionVerb} to this market, with estimated ${campaign.apr.toFixed(2)}% APR in ${campaign.rewardToken.symbol} rewards.`}
        />
      }
    >
      <div className="flex cursor-help items-center justify-between rounded p-3 transition-all duration-200 ease-in-out">
        <div className="flex items-center gap-3">
          {/* Campaign Type Badge */}
          <span className="rounded-sm bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-800 dark:text-green-300">
            {campaign.type === 'MORPHOSUPPLY' || campaign.type === 'MORPHOSUPPLY_SINGLETOKEN' ? 'Supply' : 'Borrow'}
          </span>

          {/* Reward Token */}
          <div className="flex items-center gap-2">
            <Image
              src={campaign.rewardToken.icon}
              alt={campaign.rewardToken.symbol}
              width={18}
              height={18}
              className="rounded-full"
            />
            <span className="font-medium text-sm">
              {campaign.rewardToken.symbol}
            </span>
          </div>

          {/* APR */}
          <span className="font-bold text-green-600 dark:text-green-400 text-sm">
            +{campaign.apr.toFixed(2)}% APR
          </span>
        </div>

        {/* External Link */}
        <Link
          href={merklUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-green-600 transition-opacity hover:opacity-70 dark:text-green-400"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLinkIcon />
        </Link>
      </div>
    </Tooltip>
  );
}

export function RewardsInfo({ marketId, loanTokenAddress, chainId }: RewardsInfoProps) {
  const { activeCampaigns, hasActiveRewards, loading } = useMarketCampaigns(
    loanTokenAddress && chainId
      ? { marketId, loanTokenAddress, chainId }
      : marketId
  );

  if (loading || !hasActiveRewards) {
    return null;
  }

  return (
    <div className="rounded border border-green-200 bg-green-50/50 p-4 dark:border-green-700 dark:bg-green-900/20">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <FaGift className="text-green-600 dark:text-green-400" size={16} />
        <span className="font-medium text-green-800 dark:text-green-200">
          Reward Campaign
        </span>
      </div>

      {/* Campaign Rows */}
      <div className="space-y-2">
        {activeCampaigns.map((campaign, index) => (
          <RewardCampaignRow key={index} campaign={campaign} />
        ))}
      </div>
    </div>
  );
}
'use client';

import { Cross1Icon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/common/Button';
import { getMerklCampaignURL } from '@/utils/external';
import { SimplifiedCampaign } from '@/utils/merklTypes';

type CampaignModalProps = {
  isOpen: boolean;
  onClose: () => void;
  campaigns: SimplifiedCampaign[];
};

function CampaignRow({ campaign }: { campaign: SimplifiedCampaign }) {
  // For SINGLETOKEN campaigns, use the targetToken address, for others use first 42 chars of marketId
  const urlIdentifier =
    campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
      ? campaign.targetToken?.address || campaign.campaignId
      : campaign.marketId.slice(0, 42);
  const merklUrl = getMerklCampaignURL(campaign.chainId, campaign.type, urlIdentifier);

  const actionType =
    campaign.type === 'MORPHOSUPPLY' || campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
      ? 'lenders'
      : 'borrowers';
  const actionVerb =
    campaign.type === 'MORPHOSUPPLY' || campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
      ? 'lend'
      : 'borrow';

  return (
    <div className="bg-hovered rounded-sm border border-gray-200/20 p-4 dark:border-gray-600/15">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Campaign Type Badge */}
          <span className="rounded-sm bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-800 dark:text-green-300">
            {campaign.type === 'MORPHOSUPPLY' || campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
              ? 'Lender Rewards'
              : 'Borrow Rewards'}
          </span>

          {/* Reward Token */}
          <div className="flex items-center gap-2">
            <Image
              src={campaign.rewardToken.icon}
              alt={campaign.rewardToken.symbol}
              width={20}
              height={20}
              className="rounded-full"
            />
            <span className='text-normal'>{campaign.rewardToken.symbol}</span>
          </div>
        </div>

        {/* APR */}
        <span className="text text-green-600 dark:text-green-400">
          +{campaign.apr.toFixed(2)}% APR
        </span>
      </div>

      <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Extra incentives for all {actionType} who {actionVerb} to this market, earning{' '}
        {campaign.rewardToken.symbol} rewards.
      </div>

      <div className="flex justify-end">
        <Link href={merklUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="light" size="sm" className="text-xs">
            <ExternalLinkIcon className="mr-1" />
            View on Merkl
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function CampaignModal({ isOpen, onClose, campaigns }: CampaignModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: 50 }}
    >
      <div className="bg-surface relative w-full max-w-2xl rounded p-6">
        <div className="flex flex-col">
          <button
            type="button"
            className="absolute right-2 top-2 text-secondary opacity-60 transition-opacity hover:opacity-100"
            onClick={onClose}
          >
            <Cross1Icon />
          </button>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-2xl">Active Reward Campaigns</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <CampaignRow key={campaign.campaignId} campaign={campaign}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
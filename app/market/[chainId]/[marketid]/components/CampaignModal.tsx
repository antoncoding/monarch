'use client';

import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/common/Button';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
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
            <span className="text-normal">{campaign.rewardToken.symbol}</span>
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
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" backdrop="blur">
      <ModalHeader
        title="Active Reward Campaigns"
        description="Earn extra incentives from live Merkl programs"
        mainIcon={<ExternalLinkIcon className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="space-y-4">
        {campaigns.map((campaign) => (
          <CampaignRow key={campaign.campaignId} campaign={campaign} />
        ))}
      </ModalBody>
    </Modal>
  );
}

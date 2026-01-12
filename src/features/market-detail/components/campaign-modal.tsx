'use client';

import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { getMerklCampaignURL } from '@/utils/external';
import type { SimplifiedCampaign, MerklCampaignType } from '@/utils/merklTypes';

const CAMPAIGN_TYPE_CONFIG: Record<MerklCampaignType, { badge: string; actionType: string; actionVerb: string }> = {
  MORPHOSUPPLY: { badge: 'Lender Rewards', actionType: 'lenders', actionVerb: 'lend' },
  MORPHOSUPPLY_SINGLETOKEN: { badge: 'Lender Rewards', actionType: 'lenders', actionVerb: 'lend' },
  MULTILENDBORROW: { badge: 'Lend/Borrow Rewards', actionType: 'users', actionVerb: 'participate in' },
  MORPHOBORROW: { badge: 'Borrow Rewards', actionType: 'borrowers', actionVerb: 'borrow' },
};

type CampaignModalProps = {
  isOpen: boolean;
  onClose: () => void;
  campaigns: SimplifiedCampaign[];
};

function getUrlIdentifier(campaign: SimplifiedCampaign): string {
  switch (campaign.type) {
    case 'MORPHOSUPPLY_SINGLETOKEN':
      return campaign.targetToken?.address ?? campaign.campaignId;
    case 'MULTILENDBORROW':
      return campaign.opportunityIdentifier ?? campaign.campaignId;
    default:
      return campaign.marketId.slice(0, 42);
  }
}

function CampaignRow({ campaign }: { campaign: SimplifiedCampaign }) {
  const urlIdentifier = getUrlIdentifier(campaign);
  const merklUrl = getMerklCampaignURL(campaign.chainId, campaign.type, urlIdentifier);

  const { badge, actionType, actionVerb } = CAMPAIGN_TYPE_CONFIG[campaign.type] ?? CAMPAIGN_TYPE_CONFIG.MORPHOSUPPLY;

  return (
    <div className="bg-hovered rounded-sm border border-gray-200/20 p-4 dark:border-gray-600/15">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Campaign Type Badge */}
          <span className="rounded-sm bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-800 dark:text-green-300">{badge}</span>

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
        <span className="text text-green-600 dark:text-green-400">+{campaign.apr.toFixed(2)}% APR</span>
      </div>

      <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Extra incentives for all {actionType} who {actionVerb} to this market, earning {campaign.rewardToken.symbol} rewards.
      </div>

      <div className="flex justify-end">
        <Link
          href={merklUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
          >
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
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalHeader
        title="Active Reward Campaigns"
        description="Earn extra incentives from live Merkl programs"
        mainIcon={<ExternalLinkIcon className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="space-y-4">
        {campaigns.map((campaign) => (
          <CampaignRow
            key={`${campaign.campaignId}-${campaign.marketId}`}
            campaign={campaign}
          />
        ))}
      </ModalBody>
    </Modal>
  );
}

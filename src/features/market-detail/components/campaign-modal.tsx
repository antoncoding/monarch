'use client';

import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { getMerklCampaignURL } from '@/utils/external';
import { isBorrowCampaign } from '@/utils/merklApi';
import type { SimplifiedCampaign, MerklCampaignType } from '@/utils/merklTypes';

const CAMPAIGN_TYPE_CONFIG: Record<MerklCampaignType, { badge: string }> = {
  MORPHOSUPPLY: { badge: 'Lender Rewards' },
  MORPHOSUPPLY_SINGLETOKEN: { badge: 'Lender Rewards' },
  MULTILENDBORROW: { badge: 'Lend/Borrow Rewards' },
  MORPHOBORROW: { badge: 'Borrow Rate Offset' },
};

type CampaignModalProps = {
  isOpen: boolean;
  onClose: () => void;
  campaigns: SimplifiedCampaign[];
};

function getUrlIdentifier(campaign: SimplifiedCampaign): string {
  // Always prefer opportunityIdentifier from the Opportunity object
  if (campaign.opportunityIdentifier) {
    return campaign.opportunityIdentifier;
  }
  // Fallback for legacy data
  switch (campaign.type) {
    case 'MORPHOSUPPLY_SINGLETOKEN':
      return campaign.targetToken?.address ?? campaign.campaignId;
    default:
      return campaign.marketId.slice(0, 42);
  }
}

function formatCampaignDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CampaignRow({ campaign }: { campaign: SimplifiedCampaign }) {
  const urlIdentifier = getUrlIdentifier(campaign);
  const merklUrl = getMerklCampaignURL(campaign.chainId, campaign.type, urlIdentifier);

  const { badge } = CAMPAIGN_TYPE_CONFIG[campaign.type] ?? CAMPAIGN_TYPE_CONFIG.MORPHOSUPPLY;
  const isBorrowReward = isBorrowCampaign(campaign);
  const rewardSign = isBorrowReward ? '-' : '+';
  const rateLabel = isBorrowReward ? 'Borrow APR offset' : 'Reward APR';

  return (
    <div className="bg-hovered rounded-sm border border-gray-200/20 p-4 dark:border-gray-600/15">
      {/* Header: Badge + Reward Token + APR */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-sm bg-primary/10 px-2 py-1 text-xs text-primary">{badge}</span>
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
        <div className="text-right text-primary">
          <span className="block text-sm">
            {rewardSign}
            {campaign.apr.toFixed(2)}% APR
          </span>
          <span className="block text-[11px] text-secondary">{rateLabel}</span>
        </div>
      </div>

      {/* Campaign Name */}
      {campaign.name && <h4 className="mb-2 text-sm font-medium">{campaign.name}</h4>}

      {/* Date Range + Link */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-500">
          {formatCampaignDate(campaign.startTimestamp)} — {formatCampaignDate(campaign.endTimestamp)}
        </span>
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

  const hasBorrowCampaigns = campaigns.some(isBorrowCampaign);
  const hasSupplyCampaigns = campaigns.some((campaign) => !isBorrowCampaign(campaign));
  const isBorrowOnly = hasBorrowCampaigns && !hasSupplyCampaigns;

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
        title={isBorrowOnly ? 'Active Borrow Incentives' : 'Active Reward Campaigns'}
        description={isBorrowOnly ? 'Borrower incentives reduce the displayed borrow cost.' : 'Live Merkl incentives for this market.'}
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

'use client';

import { useState } from 'react';
import { FaGift } from 'react-icons/fa';
import { Badge } from '@/components/common/Badge';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { CampaignModal } from './CampaignModal';

type CampaignBadgeProps = {
  marketId: string;
  loanTokenAddress: string;
  chainId: number;
};

export function CampaignBadge({ marketId, loanTokenAddress, chainId }: CampaignBadgeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { activeCampaigns, hasActiveRewards, loading } = useMarketCampaigns({
    marketId,
    loanTokenAddress,
    chainId,
  });

  if (loading || !hasActiveRewards) {
    return null;
  }

  const totalBonus = activeCampaigns.reduce((sum, campaign) => sum + campaign.apr, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center transition-opacity hover:opacity-80"
      >
        <Badge variant="success" size="md" className="flex cursor-pointer items-center px-2 py-1">
          <FaGift size={15} className="mr-1" />+{totalBonus.toFixed(1)}%
        </Badge>
      </button>

      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaigns={activeCampaigns}
      />
    </>
  );
}

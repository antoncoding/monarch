'use client';

import { useState, useMemo } from 'react';
import { FaGift } from 'react-icons/fa';
import { Badge } from '@/components/ui/badge';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { CampaignModal } from './campaign-modal';

type CampaignBadgeProps = {
  marketId: string;
  loanTokenAddress: string;
  chainId: number;
  whitelisted: boolean;
  filterType?: 'supply' | 'borrow';
};

export function CampaignBadge({ marketId, loanTokenAddress, chainId, whitelisted, filterType }: CampaignBadgeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { activeCampaigns, hasActiveRewards, loading } = useMarketCampaigns({
    marketId,
    loanTokenAddress,
    chainId,
    whitelisted,
  });

  // Filter campaigns by type if filterType is specified
  const filteredCampaigns = useMemo(() => {
    if (!filterType) return activeCampaigns;

    return activeCampaigns.filter((campaign) =>
      filterType === 'borrow' ? campaign.type === 'MORPHOBORROW' : campaign.type !== 'MORPHOBORROW',
    );
  }, [activeCampaigns, filterType]);

  if (loading || !hasActiveRewards || filteredCampaigns.length === 0) {
    return null;
  }

  const totalBonus = filteredCampaigns.reduce((sum, campaign) => sum + campaign.apr, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center transition-opacity hover:opacity-80"
      >
        <Badge
          variant="success"
          size="md"
          className="flex cursor-pointer items-center px-2 py-1"
        >
          <FaGift
            size={15}
            className="mr-1"
          />
          +{totalBonus.toFixed(1)}%
        </Badge>
      </button>

      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaigns={filteredCampaigns}
      />
    </>
  );
}

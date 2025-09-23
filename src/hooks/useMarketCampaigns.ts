import { useMemo } from 'react';
import { SimplifiedCampaign } from '@/utils/merklTypes';
import { useMerklCampaigns } from './useMerklCampaigns';

type UseMarketCampaignsReturn = {
  campaigns: SimplifiedCampaign[];
  activeCampaigns: SimplifiedCampaign[];
  hasRewards: boolean;
  hasActiveRewards: boolean;
  loading: boolean;
  error: string | null;
};

export function useMarketCampaigns(marketId: string): UseMarketCampaignsReturn {
  const { campaigns: allCampaigns, loading, error } = useMerklCampaigns();

  const result = useMemo(() => {
    const normalizedMarketId = marketId.toLowerCase();

    // Filter campaigns for this specific market
    const marketCampaigns = allCampaigns.filter(
      campaign => campaign.marketId.toLowerCase() === normalizedMarketId
    );

    const activeCampaigns = marketCampaigns.filter(campaign => campaign.isActive);


    return {
      campaigns: marketCampaigns,
      activeCampaigns,
      hasRewards: marketCampaigns.length > 0,
      hasActiveRewards: activeCampaigns.length > 0,
      loading,
      error,
    };
  }, [allCampaigns, marketId, loading, error]);

  return result;
}
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

type MarketCampaignsOptions = {
  marketId: string;
  loanTokenAddress?: string;
  chainId?: number;
};

export function useMarketCampaigns(
  options: string | MarketCampaignsOptions
): UseMarketCampaignsReturn {
  const { campaigns: allCampaigns, loading, error } = useMerklCampaigns();

  const result = useMemo(() => {
    // Handle both string and object parameters for backward compatibility
    const marketId = typeof options === 'string' ? options : options.marketId;
    const loanTokenAddress = typeof options === 'string' ? undefined : options.loanTokenAddress;
    const chainId = typeof options === 'string' ? undefined : options.chainId;

    const normalizedMarketId = marketId.toLowerCase();

    // Filter campaigns for this specific market
    const directMarketCampaigns = allCampaigns.filter(
      campaign => campaign.marketId.toLowerCase() === normalizedMarketId
    );

    // For SINGLETOKEN campaigns, also include campaigns where the loan token matches the target token
    const singleTokenCampaigns = loanTokenAddress && chainId
      ? allCampaigns.filter(campaign =>
          campaign.type === 'MORPHOSUPPLY_SINGLETOKEN' &&
          campaign.chainId === chainId &&
          campaign.targetToken?.address.toLowerCase() === loanTokenAddress.toLowerCase()
        )
      : [];

    // Combine both types of campaigns
    const allMarketCampaigns = [...directMarketCampaigns, ...singleTokenCampaigns];
    const activeCampaigns = allMarketCampaigns.filter(campaign => campaign.isActive);

    return {
      campaigns: allMarketCampaigns,
      activeCampaigns,
      hasRewards: allMarketCampaigns.length > 0,
      hasActiveRewards: activeCampaigns.length > 0,
      loading,
      error,
    };
  }, [allCampaigns, options, loading, error]);

  return result;
}
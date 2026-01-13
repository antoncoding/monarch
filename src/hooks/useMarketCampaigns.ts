import { useMemo } from 'react';
import type { SimplifiedCampaign } from '@/utils/merklTypes';
import { useMerklCampaignsQuery } from './queries/useMerklCampaignsQuery';

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
  whitelisted: boolean;
};

export function useMarketCampaigns(options: MarketCampaignsOptions): UseMarketCampaignsReturn {
  const { campaigns: allCampaigns, loading, error } = useMerklCampaignsQuery();

  const result = useMemo(() => {
    // Handle both string and object parameters for backward compatibility
    const { marketId, loanTokenAddress, chainId, whitelisted } = options;

    const normalizedMarketId = marketId.toLowerCase();

    // Filter campaigns for this specific market
    const directMarketCampaigns = allCampaigns.filter((campaign) => campaign.marketId?.toLowerCase() === normalizedMarketId);

    // For SINGLETOKEN campaigns, also include campaigns where the loan token matches the target token
    // the market has to be whitelisted
    const singleTokenCampaigns =
      loanTokenAddress && chainId && whitelisted
        ? allCampaigns.filter(
            (campaign) =>
              campaign.type === 'MORPHOSUPPLY_SINGLETOKEN' &&
              campaign.chainId === chainId &&
              campaign.targetToken?.address.toLowerCase() === loanTokenAddress.toLowerCase(),
          )
        : [];

    // Combine both types of campaigns
    const allMarketCampaigns = [...directMarketCampaigns, ...singleTokenCampaigns];
    const activeCampaigns = allMarketCampaigns.filter((campaign) => campaign.isActive);

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

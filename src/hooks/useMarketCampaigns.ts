import { useMemo } from 'react';
import type { SimplifiedCampaign } from '@/utils/merklTypes';
import { useMerklCampaignsQuery } from './queries/useMerklCampaignsQuery';

// Blacklisted campaign IDs - these will be filtered out
const BLACKLISTED_CAMPAIGN_IDS: string[] = [
  // Seems to be reporting bad APY, not singleton for all market for sure
  // https://app.merkl.xyz/opportunities/base/MORPHOSUPPLY_SINGLETOKEN/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  '0x4b5aa0f66eb6a63e3b761de8fbbcc8154d568086c1234ba58516f3263a79200a',
  // https://app.merkl.xyz/opportunities/base/MORPHOSUPPLY_SINGLETOKEN/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913WHITELIST_PER_PROTOCOL
  '0x3dd9c2e06ceb004c58e634c18c27de6ad05ae91804144f57130c9394f9b87633',
];

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

    // Combine both types of campaigns and filter out blacklisted ones
    const allMarketCampaigns = [...directMarketCampaigns, ...singleTokenCampaigns].filter(
      (campaign) => !BLACKLISTED_CAMPAIGN_IDS.includes(campaign.campaignId.toLowerCase()),
    );

    console.log(`[useMarketCampaigns] Active Campaigns for market ${normalizedMarketId.slice(0, 6)}`, allMarketCampaigns);

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

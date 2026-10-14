import { useMemo } from 'react';
import type { SimplifiedCampaign } from '@/utils/merklTypes';
import { useMerklCampaignsQuery } from './queries/useMerklCampaignsQuery';

// Blacklisted campaign IDs - these will be filtered out
const BLACKLISTED_CAMPAIGN_IDS: string[] = [
  // Seems to be reporting bad APY, not singleton for all market for sure
  // https://app.merkl.xyz/opportunities/base/MORPHOSUPPLY_SINGLETOKEN/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  '0x4b5aa0f66eb6a63e3b761de8fbbcc8154d568086c1234ba58516f3263a79200a',
  // https://app.merkl.xyz/opportunities/base/MORPHOSUPPLY_SINGLETOKEN/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913WHITELIST_PER_PROTOCOL
  '0x97380b45eed593b3108275de15ba89e452eaffeb04f0ffc7d8f131cf8c70f7a3',
  '0x515f512312edec4254029e0696fc0df3862dcbf1a18e9e8e345f7c52ec528b0a', // mainnet
];

type UseMarketCampaignsReturn = {
  campaigns: SimplifiedCampaign[];
  activeCampaigns: SimplifiedCampaign[];
  hasRewards: boolean;
  hasActiveRewards: boolean;
  loading: boolean;
  error: string | null;
};

export type MarketCampaignsOptions = {
  marketId: string;
  loanTokenAddress?: string;
  chainId: number;
  whitelisted: boolean;
};

export function isCampaignForMarket(
  campaign: SimplifiedCampaign,
  { marketId, loanTokenAddress, chainId, whitelisted }: MarketCampaignsOptions,
): boolean {
  const isDirectMarketCampaign = campaign.chainId === chainId && campaign.marketId.toLowerCase() === marketId.toLowerCase();
  const isSingleTokenCampaign =
    !!loanTokenAddress &&
    whitelisted &&
    campaign.type === 'MORPHOSUPPLY_SINGLETOKEN' &&
    campaign.chainId === chainId &&
    campaign.targetToken?.address.toLowerCase() === loanTokenAddress.toLowerCase();

  if (!(isDirectMarketCampaign || isSingleTokenCampaign)) return false;
  if (BLACKLISTED_CAMPAIGN_IDS.includes(campaign.campaignId.toLowerCase())) return false;
  return !campaign.name?.includes('Morpho Vault V2');
}

export function useMarketCampaigns(options: MarketCampaignsOptions): UseMarketCampaignsReturn {
  const { campaigns: allCampaigns, loading, error } = useMerklCampaignsQuery();
  const { marketId, loanTokenAddress, chainId, whitelisted } = options;

  const result = useMemo(() => {
    const campaigns = allCampaigns.filter((campaign) =>
      isCampaignForMarket(campaign, { marketId, loanTokenAddress, chainId, whitelisted }),
    );
    const activeCampaigns = campaigns.filter((campaign) => campaign.isActive);

    return {
      campaigns,
      activeCampaigns,
      hasRewards: campaigns.length > 0,
      hasActiveRewards: activeCampaigns.length > 0,
      loading,
      error,
    };
  }, [allCampaigns, chainId, error, loading, loanTokenAddress, marketId, whitelisted]);

  return result;
}

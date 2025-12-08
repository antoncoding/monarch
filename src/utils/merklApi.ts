import type { MerklCampaignsResponse, MerklApiParams, MerklCampaign, SimplifiedCampaign } from './merklTypes';

const MERKL_API_BASE_URL = 'https://api.merkl.xyz/v4';

export class MerklApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = MERKL_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(endpoint: string, params: MerklApiParams = {}): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    return url.toString();
  }

  async fetchCampaigns(params: MerklApiParams = {}): Promise<MerklCampaignsResponse> {
    const url = this.buildUrl('/campaigns', params);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Merkl API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as MerklCampaignsResponse;
      return data;
    } catch (error) {
      console.error('Error fetching Merkl campaigns:', error);
      throw error;
    }
  }

  async fetchActiveCampaigns(params: Omit<MerklApiParams, 'startTimestamp' | 'endTimestamp'> = {}): Promise<MerklCampaignsResponse> {
    const now = Math.floor(Date.now() / 1000);

    // Single API call with reasonable limit, no pagination loop
    return this.fetchCampaigns({
      ...params,
      items: 100, // Get up to 100 campaigns in one call
      page: 0,
      startTimestamp: 0,
      endTimestamp: now,
    });
  }
}

export function simplifyMerklCampaign(campaign: MerklCampaign): SimplifiedCampaign {
  const now = Math.floor(Date.now() / 1000);
  const isActive = campaign.startTimestamp <= now && campaign.endTimestamp > now;

  // For SINGLETOKEN campaigns, use targetToken as the identifier
  const marketId =
    campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
      ? `singletoken_${campaign.params.targetToken}_${campaign.computeChainId}`
      : campaign.params.market;

  const baseResult: SimplifiedCampaign = {
    marketId,
    chainId: campaign.computeChainId,
    campaignId: campaign.campaignId,
    type: campaign.type,
    apr: campaign.apr,
    rewardToken: {
      symbol: campaign.rewardToken.symbol,
      icon: campaign.rewardToken.icon,
      address: campaign.rewardToken.address,
    },
    startTimestamp: campaign.startTimestamp,
    endTimestamp: campaign.endTimestamp,
    isActive,
  };

  // Add type-specific fields
  if (campaign.type === 'MORPHOSUPPLY_SINGLETOKEN') {
    baseResult.targetToken = {
      symbol: campaign.params.symbolTargetToken,
      address: campaign.params.targetToken,
    };
  } else {
    baseResult.collateralToken = {
      symbol: campaign.params.symbolCollateralToken,
    };
    baseResult.loanToken = {
      symbol: campaign.params.symbolLoanToken,
    };
  }

  return baseResult;
}

export const merklApiClient = new MerklApiClient();

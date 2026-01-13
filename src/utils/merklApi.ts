import { MerklApi } from '@merkl/api';
import type { MerklCampaign, SimplifiedCampaign, MerklApiParams } from './merklTypes';

const MERKL_API_BASE_URL = 'https://api.merkl.xyz';

// Initialize the Merkl SDK singleton
export const merklClient = MerklApi(MERKL_API_BASE_URL);

// Helper function to fetch campaigns using the SDK with Adapter pattern
export async function fetchCampaigns(params: MerklApiParams = {}): Promise<MerklCampaign[]> {
  try {
    const queryParams: Record<string, unknown> = {};

    if (params.type) queryParams.type = params.type;
    if (params.chainId !== undefined) queryParams.chainId = params.chainId;
    if (params.items !== undefined) queryParams.items = params.items;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.startTimestamp !== undefined) queryParams.startTimestamp = params.startTimestamp;
    if (params.endTimestamp !== undefined) queryParams.endTimestamp = params.endTimestamp;

    const { data, error, status } = await merklClient.v4.campaigns.get({
      query: {
        ...queryParams,
        mainProtocolId: 'morpho',
        withOpportunity: true,
      },
    });

    if (error ?? status !== 200) {
      throw new Error(`Merkl API error: ${status} ${error}`);
    }

    // The SDK returns data that's compatible with our MerklCampaign type
    return data as unknown as MerklCampaign[];
  } catch (err) {
    console.error('Error fetching Merkl campaigns:', err);
    throw err;
  }
}

// Helper function to fetch active campaigns with full pagination
export async function fetchActiveCampaigns(params: Omit<MerklApiParams, 'startTimestamp' | 'endTimestamp'> = {}): Promise<MerklCampaign[]> {
  const now = Math.floor(Date.now() / 1000);
  const pageSize = params.items ?? 100; // Use provided items or default to 100
  const allCampaigns: MerklCampaign[] = [];
  let currentPage = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await fetchCampaigns({
      ...params,
      items: pageSize,
      page: currentPage,
      startTimestamp: 0,
      endTimestamp: now,
    });

    allCampaigns.push(...batch);

    // If we got fewer results than pageSize, we've reached the end
    if (batch.length < pageSize) {
      hasMore = false;
    } else {
      currentPage++;
    }
  }

  return allCampaigns;
}

// Helper to check if a campaign is currently active
function isCampaignActive(campaign: MerklCampaign): boolean {
  const now = Math.floor(Date.now() / 1000);
  return campaign.startTimestamp <= now && campaign.endTimestamp > now;
}

// Helper to extract common campaign fields
function getBaseCampaignFields(
  campaign: MerklCampaign,
): Pick<
  SimplifiedCampaign,
  | 'chainId'
  | 'campaignId'
  | 'type'
  | 'apr'
  | 'rewardToken'
  | 'startTimestamp'
  | 'endTimestamp'
  | 'isActive'
  | 'name'
  | 'opportunityIdentifier'
> {
  return {
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
    isActive: isCampaignActive(campaign),
    name: campaign.Opportunity?.name,
    opportunityIdentifier: campaign.Opportunity?.identifier,
  };
}

// Adapter function to convert SDK campaign to SimplifiedCampaign
export function simplifyMerklCampaign(campaign: MerklCampaign): SimplifiedCampaign {
  const baseFields = getBaseCampaignFields(campaign);

  // For SINGLETOKEN campaigns, use targetToken as the identifier
  const marketId =
    campaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
      ? `singletoken_${campaign.params.targetToken}_${campaign.computeChainId}`
      : campaign.params.market;

  // Add type-specific fields
  if (campaign.type === 'MORPHOSUPPLY_SINGLETOKEN') {
    return {
      ...baseFields,
      marketId,
      targetToken: {
        symbol: campaign.params.symbolTargetToken,
        address: campaign.params.targetToken,
      },
    };
  }

  return {
    ...baseFields,
    marketId,
    collateralToken: { symbol: campaign.params.symbolCollateralToken },
    loanToken: { symbol: campaign.params.symbolLoanToken },
  };
}

// Expand MULTILENDBORROW campaigns into multiple SimplifiedCampaign objects (one per market)
export function expandMultiLendBorrowCampaign(campaign: MerklCampaign): SimplifiedCampaign[] {
  const baseFields = getBaseCampaignFields(campaign);
  const markets = campaign.params.markets ?? [];

  return markets.map((m) => ({
    ...baseFields,
    marketId: m.campaignParameters.market,
    collateralToken: { symbol: m.campaignParameters.symbolCollateralToken },
    loanToken: { symbol: m.campaignParameters.symbolLoanToken },
  }));
}

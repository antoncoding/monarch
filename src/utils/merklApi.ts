import type { MerklCampaign, SimplifiedCampaign, MerklApiParams, MerklOpportunityLookupParams, MerklOpportunity } from './merklTypes';

const MERKL_API_BASE_URL = 'https://api.merkl.xyz';

const MERKL_LIVE_STATUS = 'LIVE';
const MERKL_HOLD_ACTION = 'HOLD';

type MerklQueryValue = string | number | boolean | readonly (string | number | boolean)[];

type MerklApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

const buildMerklUrl = (path: string, query: Record<string, MerklQueryValue | null | undefined> = {}): string => {
  const url = new URL(path, MERKL_API_BASE_URL);

  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
};

export async function fetchMerklApi<T>(
  path: string,
  query?: Record<string, MerklQueryValue | null | undefined>,
): Promise<MerklApiResult<T>> {
  const response = await fetch(buildMerklUrl(path, query));
  const body = await response.text();

  if (!response.ok) {
    return {
      data: null,
      error: body || response.statusText,
      status: response.status,
    };
  }

  return {
    data: body ? (JSON.parse(body) as T) : null,
    error: null,
    status: response.status,
  };
}

// Helper function to fetch campaigns from the Merkl REST API.
export async function fetchCampaigns(params: MerklApiParams = {}): Promise<MerklCampaign[]> {
  try {
    const queryParams: Record<string, MerklQueryValue> = {};

    if (params.type) queryParams.type = params.type;
    if (params.chainId !== undefined) queryParams.chainId = params.chainId;
    if (params.items !== undefined) queryParams.items = params.items;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.startTimestamp !== undefined) queryParams.startTimestamp = params.startTimestamp;
    if (params.endTimestamp !== undefined) queryParams.endTimestamp = params.endTimestamp;

    const { data, error, status } = await fetchMerklApi<MerklCampaign[]>('/v4/campaigns', {
      ...queryParams,
      mainProtocolId: 'morpho',
      withOpportunity: true,
    });

    if (error || status !== 200) {
      throw new Error(`Merkl API error: ${status} ${error}`);
    }

    return Array.isArray(data) ? data : [];
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

export const buildMerklOpportunityId = (params: Omit<MerklOpportunityLookupParams, 'campaigns'>): string =>
  `${params.chainId}-${params.type}-${params.identifier}`;

export async function fetchMerklOpportunityById(params: MerklOpportunityLookupParams): Promise<MerklOpportunity | null> {
  try {
    const opportunityId = buildMerklOpportunityId(params);
    const { data, error, status } = await fetchMerklApi<MerklOpportunity>(`/v4/opportunities/${opportunityId}`, {
      campaigns: params.campaigns ?? false,
    });

    if (status === 404) {
      return null;
    }

    if (error || status !== 200) {
      throw new Error(`Merkl API opportunity error: ${status} ${error}`);
    }

    return (data as MerklOpportunity | null) ?? null;
  } catch (err) {
    console.error('Error fetching Merkl opportunity:', err);
    throw err;
  }
}

export const isLiveHoldOpportunity = (opportunity: MerklOpportunity | null | undefined): opportunity is MerklOpportunity => {
  if (!opportunity) return false;
  const action = opportunity.action?.toUpperCase();
  const status = opportunity.status?.toUpperCase();
  const apr = opportunity.apr;
  const hasLiveCampaigns = opportunity.liveCampaigns == null || opportunity.liveCampaigns > 0;

  return (
    action === MERKL_HOLD_ACTION &&
    status === MERKL_LIVE_STATUS &&
    hasLiveCampaigns &&
    typeof apr === 'number' &&
    Number.isFinite(apr) &&
    apr > 0
  );
};

export const getMerklOpportunityAprDecimal = (opportunity: MerklOpportunity | null | undefined): number | null => {
  if (!isLiveHoldOpportunity(opportunity)) return null;
  const aprPercent = opportunity.apr ?? 0;
  return aprPercent / 100;
};

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
  | 'opportunityAction'
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
    opportunityAction: campaign.Opportunity?.action,
  };
}

// Adapter function to convert Merkl campaigns to SimplifiedCampaign.
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

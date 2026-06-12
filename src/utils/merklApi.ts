import type {
  MarketRewardType,
  MerklApiParams,
  MerklCampaign,
  MerklOpportunityLookupParams,
  MerklOpportunity,
  SimplifiedCampaign,
} from './merklTypes';

const MERKL_API_PROXY_BASE_PATH = '/api/merkl';

const MERKL_LIVE_STATUS = 'LIVE';
const MERKL_HOLD_ACTION = 'HOLD';
const DEFAULT_CAMPAIGN_PAGE_SIZE = 100;

type MerklQueryValue = string | number | boolean | readonly (string | number | boolean)[];

type MerklApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

const buildMerklUrl = (path: string, query: Record<string, MerklQueryValue | null | undefined> = {}): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return `${MERKL_API_PROXY_BASE_PATH}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
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

export async function fetchCampaigns(params: MerklApiParams = {}): Promise<MerklCampaign[]> {
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
    throw new Error(`Merkl API campaign error: ${status} ${error}`);
  }

  return Array.isArray(data) ? data : [];
}

export async function fetchActiveCampaigns(params: Omit<MerklApiParams, 'startTimestamp' | 'endTimestamp'> = {}): Promise<MerklCampaign[]> {
  const now = Math.floor(Date.now() / 1000);
  const requestedPageSize = params.items ?? DEFAULT_CAMPAIGN_PAGE_SIZE;
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0 ? requestedPageSize : DEFAULT_CAMPAIGN_PAGE_SIZE;
  const allCampaigns: MerklCampaign[] = [];
  let currentPage = 0;

  while (true) {
    const batch = await fetchCampaigns({
      ...params,
      items: pageSize,
      page: currentPage,
      startTimestamp: 0,
      endTimestamp: now,
    });

    allCampaigns.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    currentPage += 1;
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

export const isBorrowCampaign = (campaign: Pick<SimplifiedCampaign, 'opportunityAction' | 'type'>): boolean =>
  campaign.type === 'MORPHOBORROW' || campaign.opportunityAction?.toUpperCase() === 'BORROW';

const isCampaignActive = (campaign: MerklCampaign): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return campaign.startTimestamp <= now && campaign.endTimestamp > now && Number.isFinite(campaign.apr) && campaign.apr > 0;
};

const getBaseCampaignFields = (
  campaign: MerklCampaign & { type: MarketRewardType },
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
> => ({
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
});

export function simplifyMerklCampaign(campaign: MerklCampaign & { type: MarketRewardType }): SimplifiedCampaign | null {
  if (!campaign.params) return null;

  const baseFields = getBaseCampaignFields(campaign);

  if (campaign.type === 'MORPHOSUPPLY_SINGLETOKEN') {
    const targetToken = campaign.params.targetToken;
    if (!targetToken) return null;

    return {
      ...baseFields,
      marketId: `singletoken_${targetToken}_${campaign.computeChainId}`,
      targetToken: {
        symbol: campaign.params.symbolTargetToken ?? '',
        address: targetToken,
      },
    };
  }

  const marketId = campaign.params.market;
  if (!marketId) return null;

  return {
    ...baseFields,
    marketId,
    collateralToken: campaign.params.symbolCollateralToken ? { symbol: campaign.params.symbolCollateralToken } : undefined,
    loanToken: campaign.params.symbolLoanToken ? { symbol: campaign.params.symbolLoanToken } : undefined,
  };
}

export function expandMultiLendBorrowCampaign(campaign: MerklCampaign & { type: MarketRewardType }): SimplifiedCampaign[] {
  const markets = campaign.params?.markets;
  if (!markets) return [];

  const baseFields = getBaseCampaignFields(campaign);

  return markets.flatMap((market) => {
    const marketId = market.campaignParameters.market;
    if (!marketId) return [];

    return [
      {
        ...baseFields,
        marketId,
        collateralToken: { symbol: market.campaignParameters.symbolCollateralToken },
        loanToken: { symbol: market.campaignParameters.symbolLoanToken },
      },
    ];
  });
}

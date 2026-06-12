import { fetchMerklApi } from '@/utils/merklApi';
import type { MerklCampaign, MerklOpportunity } from '@/utils/merklTypes';

export type MerklVaultV2Reward = {
  supplyApr: number;
  asset: {
    address: string;
    symbol: string;
    price?: {
      usd?: number | null;
    } | null;
  };
};

export type MerklVaultV2Rewards = {
  address: string;
  apy: null;
  rewards: MerklVaultV2Reward[];
};

const MERKL_LIVE_STATUS = 'LIVE';
const MERKL_LEND_ACTION = 'LEND';

const isLiveLendOpportunity = (opportunity: MerklOpportunity): boolean => {
  const status = opportunity.status?.toUpperCase();
  const action = opportunity.action?.toUpperCase();
  const apr = opportunity.apr;
  const hasLiveCampaigns = opportunity.liveCampaigns == null || opportunity.liveCampaigns > 0;

  return (
    status === MERKL_LIVE_STATUS &&
    action === MERKL_LEND_ACTION &&
    hasLiveCampaigns &&
    typeof apr === 'number' &&
    Number.isFinite(apr) &&
    apr > 0
  );
};

const isActiveRewardCampaign = (campaign: MerklCampaign): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return campaign.startTimestamp <= now && campaign.endTimestamp > now && Number.isFinite(campaign.apr) && campaign.apr > 0;
};

const getCampaignRewards = (campaigns: MerklCampaign[] | undefined): MerklVaultV2Reward[] => {
  const rewardsByToken = new Map<string, MerklVaultV2Reward>();

  for (const campaign of campaigns ?? []) {
    if (!isActiveRewardCampaign(campaign)) {
      continue;
    }

    const token = campaign.rewardToken;
    if (!token?.address || !token.symbol) {
      continue;
    }

    const key = `${campaign.computeChainId}:${token.address.toLowerCase()}`;
    const existing = rewardsByToken.get(key);
    const supplyApr = campaign.apr / 100;

    if (existing) {
      existing.supplyApr += supplyApr;
      continue;
    }

    rewardsByToken.set(key, {
      supplyApr,
      asset: {
        address: token.address,
        symbol: token.symbol,
        price: typeof token.price === 'number' ? { usd: token.price } : null,
      },
    });
  }

  return Array.from(rewardsByToken.values());
};

export const fetchMerklVaultV2Rewards = async (vaultAddress: string, chainId: number): Promise<MerklVaultV2Rewards | null> => {
  try {
    const { data, error, status } = await fetchMerklApi<MerklOpportunity[]>('/v4/opportunities', {
      mainProtocolId: 'morpho',
      chainId,
      explorerAddress: vaultAddress,
      campaigns: true,
    });

    if (error || status !== 200) {
      throw new Error(`Merkl vault rewards fetch failed: ${status} ${error ?? ''}`.trim());
    }

    const rewards = (Array.isArray(data) ? data : [])
      .filter(isLiveLendOpportunity)
      .flatMap((opportunity) => getCampaignRewards(opportunity.campaigns));

    return {
      address: vaultAddress,
      apy: null,
      rewards,
    };
  } catch (error) {
    console.warn('Error fetching Merkl V2 vault rewards:', error);
    return null;
  }
};

import { useQuery } from '@tanstack/react-query';
import { useDeferredQueryEnable } from '@/hooks/useDeferredQueryEnable';
import { expandMultiLendBorrowCampaign, fetchActiveCampaigns, simplifyMerklCampaign } from '@/utils/merklApi';
import type { MarketRewardType, SimplifiedCampaign } from '@/utils/merklTypes';

const CAMPAIGN_TYPES_TO_FETCH: MarketRewardType[] = ['MORPHOSUPPLY', 'MORPHOBORROW', 'MORPHOSUPPLY_SINGLETOKEN', 'MULTILENDBORROW'];

const toSimplifiedCampaigns = (type: MarketRewardType, campaigns: Awaited<ReturnType<typeof fetchActiveCampaigns>>): SimplifiedCampaign[] =>
  campaigns.flatMap((campaign) => {
    const typedCampaign = {
      ...campaign,
      type,
    };

    if (type === 'MULTILENDBORROW') {
      return expandMultiLendBorrowCampaign(typedCampaign);
    }

    const simplified = simplifyMerklCampaign(typedCampaign);
    return simplified ? [simplified] : [];
  });

export const useMerklCampaignsQuery = () => {
  const enabled = useDeferredQueryEnable(true, true, 2000);
  const query = useQuery({
    queryKey: ['merkl-campaigns'],
    queryFn: async () => {
      const settledResults = await Promise.allSettled(CAMPAIGN_TYPES_TO_FETCH.map((type) => fetchActiveCampaigns({ type })));

      return settledResults.flatMap((result, index) => {
        const type = CAMPAIGN_TYPES_TO_FETCH[index];
        if (!type) return [];

        if (result.status === 'fulfilled') {
          return toSimplifiedCampaigns(type, result.value);
        }

        console.warn(`Failed to fetch ${type} campaigns:`, result.reason);
        return [];
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled,
  });

  return {
    campaigns: query.data ?? [],
    loading: !enabled || query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
};

export type MerklCampaignsQueryReturn = {
  campaigns: SimplifiedCampaign[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

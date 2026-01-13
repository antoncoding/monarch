import { useQuery } from '@tanstack/react-query';
import { fetchActiveCampaigns, simplifyMerklCampaign, expandMultiLendBorrowCampaign } from '@/utils/merklApi';
import type { SimplifiedCampaign, MerklCampaignType } from '@/utils/merklTypes';

const CAMPAIGN_TYPES_TO_FETCH: MerklCampaignType[] = ['MORPHOSUPPLY', 'MORPHOSUPPLY_SINGLETOKEN', 'MULTILENDBORROW'];

export const useMerklCampaignsQuery = () => {
  const query = useQuery({
    queryKey: ['merkl-campaigns'],
    queryFn: async () => {
      const settledResults = await Promise.allSettled(CAMPAIGN_TYPES_TO_FETCH.map((type) => fetchActiveCampaigns({ type })));

      // Extract successful results, use empty array for failed fetches
      const results = settledResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        console.warn(`Failed to fetch ${CAMPAIGN_TYPES_TO_FETCH[index]} campaigns:`, result.reason);
        return [];
      });

      // Hot Fix: the returned format changed and type no longer in current form. Insert it back
      const allRawCampaigns = results.flatMap((campaigns, index) =>
        campaigns.map((campaign) => ({
          ...campaign,
          type: CAMPAIGN_TYPES_TO_FETCH[index],
        })),
      );

      // Expand MULTILENDBORROW campaigns into multiple SimplifiedCampaign objects (one per market)
      return allRawCampaigns.flatMap((campaign) => {
        if (campaign.type === 'MULTILENDBORROW') {
          return expandMultiLendBorrowCampaign(campaign);
        }
        return simplifyMerklCampaign(campaign);
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    campaigns: query.data ?? [],
    loading: query.isLoading,
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

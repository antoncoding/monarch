import { useQuery } from '@tanstack/react-query';
import { fetchActiveCampaigns, simplifyMerklCampaign } from '@/utils/merklApi';
import type { SimplifiedCampaign, MerklCampaignType } from '@/utils/merklTypes';

export const useMerklCampaignsQuery = () => {
  const query = useQuery({
    queryKey: ['merkl-campaigns'],
    queryFn: async () => {
      const [supplyCampaigns, singleTokenCampaigns] = await Promise.all([
        fetchActiveCampaigns({ type: 'MORPHOSUPPLY' }),
        fetchActiveCampaigns({ type: 'MORPHOSUPPLY_SINGLETOKEN' }),
      ]);

      // Hot Fix: the returned format changed and type no longer in current form. Insert it back
      const transformedSupplyCampaigns = supplyCampaigns.map((campaign) => {
        return { ...campaign, type: 'MORPHOSUPPLY' as MerklCampaignType };
      });
      const transformedSingleTokenCampaigns = singleTokenCampaigns.map((campaign) => {
        return { ...campaign, type: 'MORPHOSUPPLY_SINGLETOKEN' as MerklCampaignType };
      });

      const allRawCampaigns = [...transformedSupplyCampaigns, ...transformedSingleTokenCampaigns];
      return allRawCampaigns.map((campaign) => simplifyMerklCampaign(campaign));
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

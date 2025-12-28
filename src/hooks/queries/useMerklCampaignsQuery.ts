import { useQuery } from '@tanstack/react-query';
import { fetchActiveCampaigns, simplifyMerklCampaign } from '@/utils/merklApi';
import type { SimplifiedCampaign } from '@/utils/merklTypes';

export const useMerklCampaignsQuery = () => {
  const query = useQuery({
    queryKey: ['merkl-campaigns'],
    queryFn: async () => {
      const [supplyCampaigns, singleTokenCampaigns] = await Promise.all([
        fetchActiveCampaigns({ type: 'MORPHOSUPPLY' }),
        fetchActiveCampaigns({ type: 'MORPHOSUPPLY_SINGLETOKEN' }),
      ]);

      const allRawCampaigns = [...supplyCampaigns, ...singleTokenCampaigns];
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

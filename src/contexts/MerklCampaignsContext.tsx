'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import { merklApiClient, simplifyMerklCampaign } from '@/utils/merklApi';
import { MerklCampaign, SimplifiedCampaign } from '@/utils/merklTypes';

type MerklCampaignsContextType = {
  campaigns: SimplifiedCampaign[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const MerklCampaignsContext = createContext<MerklCampaignsContextType | undefined>(undefined);

type MerklCampaignsProviderProps = {
  children: ReactNode;
};

export function MerklCampaignsProvider({ children }: MerklCampaignsProviderProps) {
  const [campaigns, setCampaigns] = useState<SimplifiedCampaign[]>([]);
  const [loading, setLoading] = useState(true); // Start as true like MarketsContext
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const allRawCampaigns: MerklCampaign[] = [];

      // Fetch both MORPHOSUPPLY and MORPHOSUPPLY_SINGLETOKEN campaigns
      const supplyCampaigns = await merklApiClient.fetchActiveCampaigns({ type: 'MORPHOSUPPLY' });
      const singleTokenCampaigns = await merklApiClient.fetchActiveCampaigns({
        type: 'MORPHOSUPPLY_SINGLETOKEN',
      });
      allRawCampaigns.push(...supplyCampaigns, ...singleTokenCampaigns);

      // Convert to simplified campaigns and normalize market IDs
      const simplifiedCampaigns = allRawCampaigns.map((campaign) => {
        const simplified = simplifyMerklCampaign(campaign);
        return {
          ...simplified,
          marketId: simplified.marketId.toLowerCase(), // Normalize to lowercase
        };
      });

      setCampaigns(simplifiedCampaigns);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch campaigns';
      setError(errorMessage);
      console.error('Error fetching Merkl campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps like MarketsContext

  useEffect(() => {
    // Simple condition like MarketsContext - run if we have no campaigns
    if (campaigns.length === 0) {
      void fetchCampaigns().catch(console.error);
    }
  }, [fetchCampaigns, campaigns.length]);

  const refetch = useCallback(async () => {
    await fetchCampaigns();
  }, [fetchCampaigns]);

  const value = useMemo(
    (): MerklCampaignsContextType => ({
      campaigns,
      loading,
      error,
      refetch,
    }),
    [campaigns, loading, error, refetch],
  );

  return <MerklCampaignsContext.Provider value={value}>{children}</MerklCampaignsContext.Provider>;
}

export function useMerklCampaigns(): MerklCampaignsContextType {
  const context = useContext(MerklCampaignsContext);

  if (context === undefined) {
    throw new Error('useMerklCampaigns must be used within a MerklCampaignsProvider');
  }

  return context;
}

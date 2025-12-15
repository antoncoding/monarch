'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, useMemo } from 'react';
import { fetchActiveCampaigns, simplifyMerklCampaign } from '@/utils/merklApi';
import type { SimplifiedCampaign } from '@/utils/merklTypes';

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
  const hasInitialized = useRef(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch both MORPHOSUPPLY and MORPHOSUPPLY_SINGLETOKEN campaigns using SDK
      const [supplyCampaigns, singleTokenCampaigns] = await Promise.all([
        fetchActiveCampaigns({ type: 'MORPHOSUPPLY' }),
        fetchActiveCampaigns({ type: 'MORPHOSUPPLY_SINGLETOKEN' }),
      ]);

      const allRawCampaigns = [...supplyCampaigns, ...singleTokenCampaigns];

      // Convert to simplified campaigns
      const simplifiedCampaigns = allRawCampaigns.map((campaign) => simplifyMerklCampaign(campaign));

      setCampaigns(simplifiedCampaigns);
      hasInitialized.current = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch campaigns';
      setError(errorMessage);
      console.error('Error fetching Merkl campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps like MarketsContext

  useEffect(() => {
    // Only fetch once on mount
    if (!hasInitialized.current) {
      void fetchCampaigns().catch(console.error);
    }
  }, [fetchCampaigns]);

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

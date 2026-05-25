import { useQuery } from '@tanstack/react-query';
import { useDeferredQueryEnable } from '@/hooks/useDeferredQueryEnable';
import { DATA_API_BASE_URL } from '@/utils/urls';

export type AssetRiskEntry = {
  token: {
    symbol: string;
  };
  source?: {
    assetId?: string | null;
  };
  scores: {
    overallGrade: string | null;
    overallScore: number | null;
    liquidityScore: number | null;
    previousOverallGrade?: string | null;
    recentlyDegraded?: boolean;
  };
  peg: {
    activeDepeg: boolean;
    activeDepegBps: number | null;
  };
};

type AssetRiskResponse = {
  assets: Record<string, AssetRiskEntry>;
};

const ASSET_RISK_REFRESH_MS = 15 * 60 * 1000;

const getAssetRiskResponseKey = (address: string, chainId: number): string => `${chainId}:${address.toLowerCase()}`;

const fetchAssetRisk = async (chainId: number): Promise<AssetRiskResponse> => {
  const response = await fetch(`${DATA_API_BASE_URL}/v1/risk/assets?chain_id=${chainId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch asset risk data');
  }

  return response.json();
};

export const useAssetRiskEntry = (address: string, chainId: number, enabled = true) => {
  const queryEnabled = useDeferredQueryEnable(enabled, true, 2000);
  const query = useQuery({
    queryKey: ['asset-risk', chainId],
    queryFn: () => fetchAssetRisk(chainId),
    staleTime: ASSET_RISK_REFRESH_MS,
    enabled: queryEnabled && Boolean(DATA_API_BASE_URL),
  });

  return {
    assetRisk: query.data?.assets[getAssetRiskResponseKey(address, chainId)],
    ...query,
  };
};

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'viem';
import { useTokens } from '@/components/providers/TokenProvider';
import { fetchVaultV2Details, VaultV2Cap } from '@/data-sources/subgraph/v2-vaults';
import { getSlicedAddress } from '@/utils/address';
import { SupportedNetworks } from '@/utils/networks';

type UseVaultV2DataArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  fallbackName?: string;
  fallbackSymbol?: string;
};

export type VaultV2Data = {
  displayName: string;
  displaySymbol: string;
  assetAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  totalSupply: string;
  allocators: string[];
  sentinels: string[];
  owner: string;
  curator: string;
  caps: VaultV2Cap[];
  adopters: string[];
  curatorDisplay: string;
};

type UseVaultV2DataReturn = {
  data: VaultV2Data | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useVaultV2Data({
  vaultAddress,
  chainId,
  fallbackName = '',
  fallbackSymbol = '',
}: UseVaultV2DataArgs): UseVaultV2DataReturn {
  const { findToken } = useTokens();

  const [data, setData] = useState<VaultV2Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!vaultAddress) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchVaultV2Details(vaultAddress, chainId);

      if (!result) {
        setData(null);
        return;
      }

      const token = result.asset ? findToken(result.asset, chainId) : undefined;
      const curatorDisplay = result.curator ? getSlicedAddress(result.curator as Address) : '--';

      setData({
        displayName: result.name || fallbackName,
        displaySymbol: result.symbol || fallbackSymbol,
        assetAddress: result.asset,
        tokenSymbol: token?.symbol,
        tokenDecimals: token?.decimals,
        totalSupply: result.totalSupply,
        allocators: result.allocators,
        sentinels: result.sentinels,
        owner: result.owner,
        curator: result.curator,
        caps: result.caps,
        adopters: result.adopters,
        curatorDisplay,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vault data'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [vaultAddress, chainId, fallbackName, fallbackSymbol, findToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refetch: load,
    }),
    [data, error, load, loading],
  );
}

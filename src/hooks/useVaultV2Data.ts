import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'viem';
import { useTokens } from '@/components/providers/TokenProvider';
import { fetchVaultV2Details, VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { getSlicedAddress } from '@/utils/address';
import { parseCapIdParams } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';

type UseVaultV2DataArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  fallbackName?: string;
  fallbackSymbol?: string;
};

export type CapData = {
  adapterCap: VaultV2Cap | null,
  collateralCaps: VaultV2Cap[],
  marketCaps: VaultV2Cap[],
  needSetupCaps: boolean
}

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
  capsData: CapData
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

      // Parse caps by level using parseCapIdParams
      let adapterCap: VaultV2Cap | null = null;
      const collateralCaps: VaultV2Cap[] = [];
      const marketCaps: VaultV2Cap[] = [];

      result.caps.forEach((cap) => {
        const parsed = parseCapIdParams(cap.idParams);

        if (parsed.type === 'adapter') {
          adapterCap = cap;
        } else if (parsed.type === 'collateral') {
          collateralCaps.push(cap);
        } else if (parsed.type === 'market') {
          marketCaps.push(cap);
        }
      });

      // if any one of the caps is not set, it means it still need setup!
      const needSetupCaps = !adapterCap || collateralCaps.length === 0 || marketCaps.length === 0

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
        capsData: {
          adapterCap,
          collateralCaps,
          marketCaps,
          needSetupCaps
        },
        adopters: result.adopters,
        curatorDisplay,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vault data'));
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultAddress, chainId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Memoize the refetch function to prevent unnecessary re-renders in parent components
  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refetch,
    }),
    [data, error, loading, refetch],
  );
}

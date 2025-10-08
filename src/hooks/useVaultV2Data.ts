import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address, formatUnits } from 'viem';
import { useTokens } from '@/components/providers/TokenProvider';
import { fetchVaultV2 } from '@/data-sources/morpho-api/vaults';
import { getSlicedAddress } from '@/utils/address';
import { formatReadable } from '@/utils/balance';

const normalize = (value?: string | null) => value?.toLowerCase().trim() ?? undefined;

type UseVaultV2DataArgs = {
  vaultAddress?: Address;
  chainId: number;
  fallbackName?: string;
  fallbackSymbol?: string;
  onChainName?: string | null;
  onChainSymbol?: string | null;
  ownerAddress?: Address;
  defaultAllocatorAddresses?: string[];
};

export type VaultV2ComputedData = {
  displayName: string;
  displaySymbol: string;
  assetAddress?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  totalSupplyDisplay: string;
  totalSupplyRaw?: string;
  allocatorAddresses: string[];
  allocatorCount: number;
  ownerAddress?: string;
  curatorAddress?: string;
  guardianAddresses: string[];
  curatorDisplay: string;
};

type UseVaultV2DataReturn = {
  data: VaultV2ComputedData;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useVaultV2Data({
  vaultAddress,
  chainId,
  fallbackName = '',
  fallbackSymbol = '',
  onChainName,
  onChainSymbol,
  ownerAddress,
  defaultAllocatorAddresses,
}: UseVaultV2DataArgs): UseVaultV2DataReturn {
  const { findToken } = useTokens();

  const normalizedOwner = useMemo(() => normalize(ownerAddress), [ownerAddress]);
  const allocatorInputKey = useMemo(() => {
    if (!defaultAllocatorAddresses?.length) return '';
    return defaultAllocatorAddresses.map((addr) => normalize(addr) ?? '').join('|');
  }, [defaultAllocatorAddresses]);

  const defaultAllocators = useMemo(() => {
    if (!defaultAllocatorAddresses?.length) return [];
    return defaultAllocatorAddresses
      .map((addr) => normalize(addr))
      .filter((addr): addr is string => Boolean(addr));
  }, [allocatorInputKey]);

  const buildData = useCallback(
    (item: {
      name?: string;
      symbol?: string;
      totalSupply?: string;
      assetAddress?: string;
      assetDecimals?: number;
      allocatorAddresses: string[];
      curatorAddress?: string;
    } | null): VaultV2ComputedData => {
      const assetAddress = item?.assetAddress;
      const token = assetAddress ? findToken(assetAddress, chainId) : undefined;
      const assetDecimals = item?.assetDecimals;

      const displayName = (item?.name?.trim() || onChainName?.trim() || fallbackName).trim();
      const displaySymbol = (item?.symbol?.trim() || onChainSymbol?.trim() || fallbackSymbol).trim();

      let totalSupplyDisplay = '--';
      if (item?.totalSupply) {
        try {
          const decimals = token?.decimals ?? assetDecimals ?? 18;
          const parsed = Number(formatUnits(BigInt(item.totalSupply), decimals));
          totalSupplyDisplay = `${formatReadable(parsed)} ${token?.symbol ?? displaySymbol}`;
        } catch (error) {
          console.error('Failed to format vault total supply', error);
        }
      }

      const normalizedAllocators = (item?.allocatorAddresses.length
        ? item.allocatorAddresses
        : defaultAllocators)
        .map((addr) => normalize(addr))
        .filter((addr): addr is string => Boolean(addr));

      const allocatorAddresses = Array.from(new Set(normalizedAllocators));

      const owner = normalizedOwner;
      const curator = item?.curatorAddress ?? undefined;
      const curatorDisplay = curator ? getSlicedAddress(curator as `0x${string}`) : '--';

      return {
        displayName,
        displaySymbol,
        assetAddress,
        tokenSymbol: token?.symbol,
        tokenDecimals: token?.decimals ?? assetDecimals,
        totalSupplyDisplay,
        totalSupplyRaw: item?.totalSupply,
        allocatorAddresses,
        allocatorCount: allocatorAddresses.length,
        ownerAddress: owner,
        curatorAddress: curator,
        guardianAddresses: [],
        curatorDisplay,
      };
    },
    [chainId, defaultAllocators, fallbackName, fallbackSymbol, findToken, normalizedOwner, onChainName, onChainSymbol],
  );

  const [data, setData] = useState<VaultV2ComputedData>(() =>
    buildData({
      name: onChainName ?? undefined,
      symbol: onChainSymbol ?? undefined,
      totalSupply: undefined,
      assetAddress: undefined,
      assetDecimals: undefined,
      allocatorAddresses: defaultAllocators,
      curatorAddress: undefined,
    }),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!vaultAddress) {
        setData(
          buildData({
            name: onChainName ?? undefined,
            symbol: onChainSymbol ?? undefined,
            totalSupply: undefined,
            assetAddress: undefined,
            assetDecimals: undefined,
            allocatorAddresses: defaultAllocators,
            curatorAddress: undefined,
          }),
        );
        return;
      }

      const result = await fetchVaultV2({ address: vaultAddress, chainId });

      if (!result) {
        setData(
          buildData({
            name: onChainName ?? undefined,
            symbol: onChainSymbol ?? undefined,
            totalSupply: undefined,
            assetAddress: undefined,
            assetDecimals: undefined,
            allocatorAddresses: defaultAllocators,
            curatorAddress: undefined,
          }),
        );
        return;
      }

      setData(
        buildData({
          name: result.name ?? undefined,
          symbol: result.symbol ?? undefined,
          totalSupply: result.totalSupply ?? undefined,
          assetAddress: normalize(result.asset?.id),
          assetDecimals: result.asset?.decimals ?? undefined,
          allocatorAddresses: (result.allocators ?? [])
            .map((entry) => normalize(entry?.allocator?.address))
            .filter((addr): addr is string => Boolean(addr)),
          curatorAddress: normalize(result.curator?.address),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vault data'));
      setData(
        buildData({
          name: onChainName ?? undefined,
          symbol: onChainSymbol ?? undefined,
          totalSupply: undefined,
          assetAddress: undefined,
          assetDecimals: undefined,
          allocatorAddresses: defaultAllocators,
          curatorAddress: undefined,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [buildData, chainId, defaultAllocators, normalizedOwner, onChainName, onChainSymbol, vaultAddress]);

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

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchListedMorphoVaultV2Metadata,
  fetchMorphoVaultV2Metadata,
  type MorphoVaultV2Metadata,
  type VaultAddressByNetwork,
} from '@/data-sources/morpho-api/vaults';

const MORPHO_VAULT_V2_METADATA_STALE_TIME_MS = 5 * 60 * 1000;
const MORPHO_VAULT_V2_METADATA_GC_TIME_MS = 30 * 60 * 1000;

type UseMorphoVaultV2MetadataQueryOptions = {
  enabled?: boolean;
  vaults: VaultAddressByNetwork[];
};

type UseListedMorphoVaultV2MetadataQueryOptions = {
  enabled?: boolean;
};

const getVaultNetworkId = (vault: VaultAddressByNetwork) => vault.chainId ?? vault.networkId;

const getVaultsKey = (vaults: VaultAddressByNetwork[]): string => {
  return Array.from(
    new Set(
      vaults
        .map((vault) => {
          const chainId = getVaultNetworkId(vault);
          return chainId ? `${chainId}:${vault.address.toLowerCase()}` : null;
        })
        .filter((key): key is string => Boolean(key)),
    ),
  )
    .sort()
    .join('|');
};

export const useMorphoVaultV2MetadataQuery = ({ enabled = true, vaults }: UseMorphoVaultV2MetadataQueryOptions) => {
  const vaultsKey = useMemo(() => getVaultsKey(vaults), [vaults]);

  return useQuery<MorphoVaultV2Metadata[], Error>({
    queryKey: ['morpho-vault-v2-metadata', vaultsKey],
    queryFn: () => fetchMorphoVaultV2Metadata(vaults),
    enabled: enabled && vaultsKey.length > 0,
    staleTime: MORPHO_VAULT_V2_METADATA_STALE_TIME_MS,
    gcTime: MORPHO_VAULT_V2_METADATA_GC_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

export const useListedMorphoVaultV2MetadataQuery = (options?: UseListedMorphoVaultV2MetadataQueryOptions) => {
  return useQuery<MorphoVaultV2Metadata[], Error>({
    queryKey: ['morpho-listed-vault-v2-metadata'],
    queryFn: fetchListedMorphoVaultV2Metadata,
    enabled: options?.enabled ?? true,
    staleTime: MORPHO_VAULT_V2_METADATA_STALE_TIME_MS,
    gcTime: MORPHO_VAULT_V2_METADATA_GC_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

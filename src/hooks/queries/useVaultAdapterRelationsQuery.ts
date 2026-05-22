import { useQuery } from '@tanstack/react-query';
import { fetchMonarchVaultAdapterRelations, type VaultAdapterRelation } from '@/data-sources/monarch-api/vaults';

const VAULT_ADAPTER_RELATIONS_STALE_TIME_MS = 10 * 60 * 1000;
const VAULT_ADAPTER_RELATIONS_GC_TIME_MS = 30 * 60 * 1000;

type UseVaultAdapterRelationsQueryOptions = {
  enabled?: boolean;
};

export const useVaultAdapterRelationsQuery = (options?: UseVaultAdapterRelationsQueryOptions) => {
  return useQuery<VaultAdapterRelation[], Error>({
    queryKey: ['monarch-vault-adapter-relations'],
    queryFn: fetchMonarchVaultAdapterRelations,
    enabled: options?.enabled ?? true,
    staleTime: VAULT_ADAPTER_RELATIONS_STALE_TIME_MS,
    gcTime: VAULT_ADAPTER_RELATIONS_GC_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

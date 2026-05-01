import { useQuery } from '@tanstack/react-query';
import { fetchMonarchVaultAdapterAliases, type VaultAdapterAlias } from '@/data-sources/monarch-api/vaults';

const VAULT_ADAPTER_ALIASES_STALE_TIME_MS = 10 * 60 * 1000;
const VAULT_ADAPTER_ALIASES_GC_TIME_MS = 30 * 60 * 1000;

export const useVaultAdapterAliasesQuery = () => {
  return useQuery<VaultAdapterAlias[], Error>({
    queryKey: ['monarch-vault-adapter-aliases'],
    queryFn: fetchMonarchVaultAdapterAliases,
    staleTime: VAULT_ADAPTER_ALIASES_STALE_TIME_MS,
    gcTime: VAULT_ADAPTER_ALIASES_GC_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

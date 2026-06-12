import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { fetchMerklVaultV2Rewards, type MerklVaultV2Rewards } from '@/data-sources/merkl/vault-rewards';
import type { SupportedNetworks } from '@/utils/networks';

type UseVaultV2RewardsQueryArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
};

export function useVaultV2RewardsQuery({ vaultAddress, chainId }: UseVaultV2RewardsQueryArgs) {
  const normalizedVaultAddress = vaultAddress?.toLowerCase() as Address | undefined;

  return useQuery<MerklVaultV2Rewards | null>({
    queryKey: ['vault-v2-rewards', normalizedVaultAddress, chainId],
    queryFn: () => fetchMerklVaultV2Rewards(normalizedVaultAddress!, chainId),
    enabled: Boolean(normalizedVaultAddress),
    staleTime: 5 * 60 * 1000,
  });
}

import { useQuery } from '@tanstack/react-query';
import { type Address, zeroAddress } from 'viem';
import { usePublicClient } from 'wagmi';
import { fetchVaultV2DeadDeposit } from '@/data-sources/rpc/vault-dead-deposit';

export function useVaultV2DeadDepositQuery(vaultAddress: Address | undefined, chainId: number) {
  const client = usePublicClient({ chainId });

  return useQuery({
    queryKey: ['vault-v2-dead-deposit', vaultAddress?.toLowerCase(), chainId],
    queryFn: () => {
      if (!client || !vaultAddress) throw new Error('Vault client unavailable');
      return fetchVaultV2DeadDeposit(client, vaultAddress);
    },
    enabled: !!client && !!vaultAddress && vaultAddress !== zeroAddress,
    staleTime: 10_000,
  });
}

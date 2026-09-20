import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { useCustomRpc } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

export function useVaultUserPositionQuery({
  vaultAddress,
  chainId,
  userAddress,
}: {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  userAddress?: Address;
}) {
  const rpcUrl = useCustomRpc((state) => state.customRpcUrls[chainId]);
  const vault = vaultAddress?.toLowerCase() as Address | undefined;
  const user = userAddress?.toLowerCase() as Address | undefined;

  return useQuery({
    queryKey: ['vault-user-position', vault, chainId, user, rpcUrl],
    queryFn: async () => {
      if (!vault || !user) throw new Error('A vault and wallet are required to read a vault position');

      const client = getClient(chainId, rpcUrl);
      const contract = { address: vault, abi: vaultv2Abi } as const;
      const shares = await client.readContract({ ...contract, functionName: 'balanceOf', args: [user] });
      // Use the vault's conversion, including virtual shares and accrued fees.
      // Failed reads must reject so they cannot replace a known position with zero.
      const assets = shares === 0n ? 0n : await client.readContract({ ...contract, functionName: 'previewRedeem', args: [shares] });
      return { shares, assets };
    },
    enabled: Boolean(vault && user),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

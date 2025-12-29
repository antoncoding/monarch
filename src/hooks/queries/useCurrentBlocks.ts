import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

export const useCurrentBlocks = (chainIds: SupportedNetworks[]) => {
  const { customRpcUrls } = useCustomRpcContext();

  return useQuery({
    queryKey: ['current-blocks', chainIds],
    queryFn: async () => {
      const blocks: Record<number, number> = {};
      await Promise.all(
        chainIds.map(async (chainId) => {
          try {
            const client = getClient(chainId, customRpcUrls[chainId]);
            const blockNumber = await client.getBlockNumber();
            blocks[chainId] = Number(blockNumber);
          } catch (error) {
            console.error(`Failed to get current block for chain ${chainId}:`, error);
          }
        }),
      );
      return blocks;
    },
    enabled: chainIds.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

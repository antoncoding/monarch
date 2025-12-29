import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

/**
 * 
 * @param snapshotBlocks { chainId: blockNumber }
 */
export const useBlockTimestamps = (snapshotBlocks: Record<number, number>) => {
  const { customRpcUrls } = useCustomRpcContext();

  return useQuery({
    queryKey: ['block-timestamps', snapshotBlocks],
    queryFn: async () => {
      const blockData: Record<number, { block: number; timestamp: number }> = {};

      await Promise.all(
        Object.entries(snapshotBlocks).map(async ([chainId, blockNum]) => {
          try {
            const client = getClient(Number(chainId) as SupportedNetworks, customRpcUrls[Number(chainId) as SupportedNetworks]);
            const block = await client.getBlock({ blockNumber: BigInt(blockNum) });
            blockData[Number(chainId)] = {
              block: blockNum,
              timestamp: Number(block.timestamp),
            };
          } catch (error) {
            console.error(`Failed to get block ${blockNum} on chain ${chainId}:`, error);
          }
        }),
      );

      return blockData;
    },
    enabled: Object.keys(snapshotBlocks).length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

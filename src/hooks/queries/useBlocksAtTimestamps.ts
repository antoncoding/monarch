import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { findBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

export const useBlocksAtTimestamps = (
  targetTimestamps: Record<number, number>,
  currentBlocks: Record<number, number> | undefined,
) => {
  const { customRpcUrls } = useCustomRpcContext();
  const chainIds = Object.keys(targetTimestamps).map(Number);
  const hasCurrentBlocks = chainIds.every((chainId) => currentBlocks?.[chainId] !== undefined);

  return useQuery({
    queryKey: ['blocks-at-timestamps', targetTimestamps, currentBlocks, customRpcUrls],
    queryFn: async () => {
      const blockData: Record<number, { block: number; timestamp: number }> = {};

      await Promise.all(
        Object.entries(targetTimestamps).map(async ([chainId, targetTimestamp]) => {
          const chainIdNumber = Number(chainId) as SupportedNetworks;
          const currentBlock = currentBlocks?.[chainIdNumber];
          if (currentBlock === undefined) {
            throw new Error(`Current block unavailable for chain ${chainIdNumber}`);
          }

          const client = getClient(chainIdNumber, customRpcUrls[chainIdNumber]);
          const block = await findBlockAtTimestamp(client, chainIdNumber, targetTimestamp, currentBlock);
          blockData[chainIdNumber] = {
            block: block.blockNumber,
            timestamp: block.timestamp,
          };
        }),
      );

      return blockData;
    },
    enabled: chainIds.length > 0 && hasCurrentBlocks,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

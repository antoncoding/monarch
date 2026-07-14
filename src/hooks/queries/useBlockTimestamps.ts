import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { SupportedNetworks } from '@/utils/networks';
import { findBlockAtTimestamp } from '@/utils/blockEstimation';
import { getClient } from '@/utils/rpc';

/**
 *
 * @param snapshotBlocks { chainId: blockNumber }
 */
export const useBlockTimestamps = (
  snapshotBlocks: Record<number, number>,
  targetTimestamp: number,
  latestBlocks: Record<number, number> | undefined,
) => {
  const { customRpcUrls } = useCustomRpcContext();

  return useQuery({
    queryKey: ['block-timestamps', snapshotBlocks, targetTimestamp, latestBlocks],
    queryFn: async () => {
      const blockData: Record<number, { block: number; timestamp: number }> = {};

      await Promise.all(
        Object.entries(snapshotBlocks).map(async ([chainId, blockNum]) => {
          try {
            const client = getClient(Number(chainId) as SupportedNetworks, customRpcUrls[Number(chainId) as SupportedNetworks]);
            const chainIdNumber = Number(chainId) as SupportedNetworks;
            const latestBlock = latestBlocks?.[chainIdNumber];
            if (latestBlock === undefined) {
              throw new Error(`Missing latest block for chain ${chainId}`);
            }
            const blockDataAtTimestamp = await findBlockAtTimestamp(client, chainIdNumber, blockNum, targetTimestamp, latestBlock);
            blockData[Number(chainId)] = {
              block: blockDataAtTimestamp.blockNumber,
              timestamp: blockDataAtTimestamp.timestamp,
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

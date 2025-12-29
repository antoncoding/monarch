import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { fetchPositionsSnapshots, type PositionSnapshot } from '@/utils/positions';
import type { MarketPosition } from '@/utils/types';

type UsePositionSnapshotsOptions = {
  positions: MarketPosition[] | undefined;
  user: string | undefined;
  snapshotBlocks: Record<number, number>;
};

export const usePositionSnapshots = ({ positions, user, snapshotBlocks }: UsePositionSnapshotsOptions) => {
  const { customRpcUrls } = useCustomRpcContext();

  return useQuery({
    queryKey: ['all-position-snapshots', snapshotBlocks, user, positions?.map((p) => p.market.uniqueKey)],
    queryFn: async () => {
      if (!positions || !user) return {};

      const snapshotsByChain: Record<number, Map<string, PositionSnapshot>> = {};

      await Promise.all(
        Object.entries(snapshotBlocks).map(async ([chainId, blockNum]) => {
          const chainIdNum = Number(chainId);
          const chainPositions = positions.filter((p) => p.market.morphoBlue.chain.id === chainIdNum);

          if (chainPositions.length === 0) return;

          const client = getClient(chainIdNum as SupportedNetworks, customRpcUrls[chainIdNum as SupportedNetworks]);
          const marketIds = chainPositions.map((p) => p.market.uniqueKey);

          const snapshots = await fetchPositionsSnapshots(marketIds, user as Address, chainIdNum, blockNum, client);

          snapshotsByChain[chainIdNum] = snapshots;
        }),
      );

      return snapshotsByChain;
    },
    enabled: !!positions && !!user && Object.keys(snapshotBlocks).length > 0,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

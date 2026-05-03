import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { supportsHistoricalStateRead, type SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { fetchPositionsSnapshots, type PositionSnapshot } from '@/utils/positions';
import { buildIndexedPositionSnapshotsAtBoundary } from '@/utils/position-boundary-snapshots';
import type { MarketPosition, UserTransaction } from '@/utils/types';
import { getUserTransactionIdentity } from '@/utils/user-transactions';

type UsePositionSnapshotsOptions = {
  positions: MarketPosition[] | undefined;
  user: string | undefined;
  snapshotBlocks: Record<number, number>;
  boundaryBlockData: Record<number, { block: number; timestamp: number }>;
  transactions: UserTransaction[];
};

export const usePositionSnapshots = ({ positions, user, snapshotBlocks, boundaryBlockData, transactions }: UsePositionSnapshotsOptions) => {
  const { customRpcUrls } = useCustomRpcContext();
  const chainIds = Object.keys(snapshotBlocks).map(Number);
  const hasBoundaryDataForIndexedChains = chainIds.every(
    (chainId) => supportsHistoricalStateRead(chainId) || Boolean(boundaryBlockData[chainId]?.timestamp),
  );
  const transactionSignature = transactions.map(getUserTransactionIdentity).join(',');

  return useQuery({
    queryKey: [
      'all-position-snapshots',
      snapshotBlocks,
      boundaryBlockData,
      user,
      positions?.map((p) => p.market.uniqueKey),
      transactionSignature,
    ],
    queryFn: async () => {
      if (!positions || !user) return {};

      const snapshotsByChain: Record<number, Map<string, PositionSnapshot>> = {};

      await Promise.all(
        Object.entries(snapshotBlocks).map(async ([chainId, blockNum]) => {
          const chainIdNum = Number(chainId);
          const chainPositions = positions.filter((p) => p.market.morphoBlue.chain.id === chainIdNum);

          if (chainPositions.length === 0) return;

          const marketIds = chainPositions.map((p) => p.market.uniqueKey);

          const snapshots = supportsHistoricalStateRead(chainIdNum)
            ? await fetchPositionsSnapshots(
                marketIds,
                user as Address,
                chainIdNum,
                blockNum,
                getClient(chainIdNum, customRpcUrls[chainIdNum]),
              )
            : await buildIndexedPositionSnapshotsAtBoundary({
                positions: chainPositions,
                transactions,
                chainId: chainIdNum as SupportedNetworks,
                boundaryTimestamp: boundaryBlockData[chainIdNum].timestamp,
              });

          snapshotsByChain[chainIdNum] = snapshots;
        }),
      );

      return snapshotsByChain;
    },
    enabled: !!positions && !!user && Object.keys(snapshotBlocks).length > 0 && hasBoundaryDataForIndexedChains,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

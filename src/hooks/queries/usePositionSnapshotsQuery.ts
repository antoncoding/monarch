import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { SupportedNetworks } from '@/utils/networks';
import { fetchPositionsSnapshots, type PositionSnapshot } from '@/utils/positions';
import { getClient } from '@/utils/rpc';

type PositionSnapshotsQueryOptions = {
  /** User address to fetch snapshots for */
  user: Address;
  /** Chain ID where positions exist */
  chainId: SupportedNetworks;
  /** Market unique keys to fetch snapshots for */
  marketIds: string[];
  /** Block number to fetch snapshots at */
  blockNumber: number;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
};

/**
 * Fetches position snapshots at a specific block number using React Query.
 *
 * This hook fetches historical balances for user positions at a specific block,
 * which is essential for calculating earnings over a time period.
 *
 * Cache behavior:
 * - staleTime: 5 minutes (historical snapshots don't change)
 * - Only runs when marketIds are provided and blockNumber > 0
 *
 * @example
 * ```tsx
 * const { data: snapshots, isLoading } = usePositionSnapshotsQuery({
 *   user: '0x...' as Address,
 *   chainId: SupportedNetworks.Mainnet,
 *   marketIds: ['market1', 'market2'],
 *   blockNumber: 19000000,
 * });
 *
 * const snapshot = snapshots?.get('market1');
 * const pastBalance = snapshot ? BigInt(snapshot.supplyAssets) : 0n;
 * ```
 */
export const usePositionSnapshotsQuery = (options: PositionSnapshotsQueryOptions) => {
  const { user, chainId, marketIds, blockNumber, enabled = true } = options;
  const { customRpcUrls } = useCustomRpcContext();

  return useQuery<Map<string, PositionSnapshot>, Error>({
    queryKey: ['position-snapshots', user, chainId, marketIds, blockNumber],
    queryFn: async () => {
      const client = getClient(chainId, customRpcUrls[chainId]);

      const snapshots = await fetchPositionsSnapshots(marketIds, user, chainId, blockNumber, client);

      return snapshots;
    },
    enabled: enabled && marketIds.length > 0 && blockNumber > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - historical snapshots are immutable
  });
};

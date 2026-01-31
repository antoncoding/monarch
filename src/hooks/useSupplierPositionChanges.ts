import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { fetchSubgraphMarketSupplies } from '@/data-sources/subgraph/market-supplies';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketActivityTransaction } from '@/utils/types';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

export type SupplierPositionChange = {
  userAddress: string;
  netChange: bigint; // positive = net supply, negative = net withdraw
  supplyTotal: bigint;
  withdrawTotal: bigint;
  transactionCount: number;
};

export type SupplierPositionChangesMap = Map<string, SupplierPositionChange>;

/**
 * Calculate net position changes from transactions
 */
function calculatePositionChanges(transactions: MarketActivityTransaction[]): SupplierPositionChangesMap {
  const changes = new Map<string, SupplierPositionChange>();

  for (const tx of transactions) {
    const address = tx.userAddress.toLowerCase();
    const amount = BigInt(tx.amount);

    let existing = changes.get(address);
    if (!existing) {
      existing = {
        userAddress: address,
        netChange: 0n,
        supplyTotal: 0n,
        withdrawTotal: 0n,
        transactionCount: 0,
      };
    }

    if (tx.type === 'MarketSupply') {
      existing.netChange += amount;
      existing.supplyTotal += amount;
    } else if (tx.type === 'MarketWithdraw') {
      existing.netChange -= amount;
      existing.withdrawTotal += amount;
    }
    existing.transactionCount += 1;

    changes.set(address, existing);
  }

  return changes;
}

/**
 * Hook to fetch 7-day supply/withdraw transactions and calculate net position changes per user.
 * Returns a map of userAddress (lowercase) -> position change data.
 *
 * @param marketId The unique key of the market.
 * @param loanAssetId The address of the loan asset.
 * @param network The blockchain network.
 * @returns Map of position changes keyed by lowercase user address.
 */
export const useSupplierPositionChanges = (
  marketId: string | undefined,
  loanAssetId: string | undefined,
  network: SupportedNetworks | undefined,
) => {
  const queryKey = ['supplierPositionChanges', marketId, loanAssetId, network];

  const queryFn = async (): Promise<SupplierPositionChangesMap> => {
    if (!marketId || !loanAssetId || !network) {
      return new Map();
    }

    const sevenDaysAgo = Math.floor(Date.now() / 1000) - SEVEN_DAYS_IN_SECONDS;
    const allTransactions: MarketActivityTransaction[] = [];

    // Fetch transactions in batches until we have all from the last 7 days
    // or reach a reasonable limit
    const pageSize = 100;
    const maxPages = 10; // Max 1000 transactions
    let currentPage = 1;
    let hasMore = true;

    while (hasMore && currentPage <= maxPages) {
      const skip = (currentPage - 1) * pageSize;
      let result = null;

      // Try Morpho API first if supported
      if (supportsMorphoApi(network)) {
        try {
          result = await fetchMorphoMarketSupplies(marketId, '0', pageSize, skip);
        } catch (morphoError) {
          console.error('Failed to fetch supplies via Morpho API:', morphoError);
        }
      }

      // Fallback to Subgraph
      if (!result) {
        try {
          result = await fetchSubgraphMarketSupplies(marketId, loanAssetId, network, '0', pageSize, skip);
        } catch (subgraphError) {
          console.error('Failed to fetch supplies via Subgraph:', subgraphError);
          break;
        }
      }

      if (!result || result.items.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to only transactions from last 7 days
      const recentTransactions = result.items.filter((tx) => tx.timestamp >= sevenDaysAgo);
      allTransactions.push(...recentTransactions);

      // If oldest transaction in this batch is older than 7 days, we have all we need
      const oldestInBatch = result.items.at(-1);
      if (oldestInBatch && oldestInBatch.timestamp < sevenDaysAgo) {
        hasMore = false;
      } else if (result.items.length < pageSize) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    return calculatePositionChanges(allTransactions);
  };

  const { data, isLoading, error, refetch } = useQuery<SupplierPositionChangesMap>({
    queryKey,
    queryFn,
    enabled: !!marketId && !!loanAssetId && !!network,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: () => new Map(),
    retry: 1,
  });

  return {
    data: data ?? new Map(),
    isLoading,
    error,
    refetch,
  };
};

export default useSupplierPositionChanges;

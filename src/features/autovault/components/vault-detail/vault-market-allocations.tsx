import { useMemo } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import type { SupportedNetworks } from '@/utils/networks';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultAllocations } from '@/hooks/useVaultAllocations';
import { TableContainerWithDescription } from '@/components/common/table-container-with-header';
import { VaultMarketAllocationsTable } from '@/features/vault/components/vault-market-allocations-table';

type VaultMarketAllocationsProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  needsInitialization: boolean;
};

export function VaultMarketAllocations({ vaultAddress, chainId, needsInitialization }: VaultMarketAllocationsProps) {
  const { address: connectedAddress } = useConnection();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData, isLoading: vaultDataLoading } = useVaultV2Data({ vaultAddress, chainId });
  const { totalAssets } = useVaultV2({ vaultAddress, chainId, connectedAddress });
  const { marketAllocations, loading: allocationsLoading } = useVaultAllocations({
    vaultAddress,
    chainId,
  });

  const isLoading = vaultDataLoading || allocationsLoading;

  // Calculate total allocation from market allocations (canonical source)
  const totalAllocation = useMemo(() => {
    if (totalAssets !== undefined) return totalAssets;
    return marketAllocations.reduce((sum, a) => sum + a.allocation, 0n);
  }, [totalAssets, marketAllocations]);

  const hasAnyAllocations = useMemo(() => totalAllocation > 0n, [totalAllocation]);

  // Show loading state while vault metadata, cap markets, or allocation reads are loading.
  if (isLoading) {
    return (
      <div className="bg-surface rounded-md font-zen shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="bg-hovered h-5 w-48 rounded mb-2 animate-pulse" />
          <div className="bg-hovered h-4 w-64 rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-hovered h-16 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!vaultData) return null;

  const hasNoAllocations = marketAllocations.length === 0;

  return (
    <TableContainerWithDescription
      title={hasAnyAllocations ? 'Active Allocations' : 'Market Configuration'}
    >
      {hasNoAllocations ? (
        <div className="p-10 flex flex-col items-center justify-center font-zen">
          <p className="text-sm text-center text-secondary">
            {needsInitialization
              ? 'Finish the vault setup to configure market caps'
              : 'No markets configured yet. Configure caps in settings to start allocating assets'}
          </p>
        </div>
      ) : (
        <VaultMarketAllocationsTable
          marketAllocations={marketAllocations}
          totalAssets={totalAllocation}
          chainId={chainId}
          allocationAssetSymbol={vaultData.tokenSymbol}
          allocationAssetDecimals={vaultData.tokenDecimals}
          showExplorerLink
        />
      )}
    </TableContainerWithDescription>
  );
}

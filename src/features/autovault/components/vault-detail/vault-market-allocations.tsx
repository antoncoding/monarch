import { useMemo, useState } from 'react';
import { IconSwitch } from '@/components/ui/icon-switch';
import { HiOutlineCube } from 'react-icons/hi';
import { MdOutlineAccountBalance } from 'react-icons/md';
import type { CollateralAllocation, MarketAllocation } from '@/types/vaultAllocations';
import type { SupportedNetworks } from '@/utils/networks';
import { useMarkets } from '@/hooks/useMarkets';
import { TableContainerWithDescription } from '@/components/common/table-container-with-header';
import { CollateralView } from './allocations/allocations/collateral-view';
import { MarketView } from './allocations/allocations/market-view';

type VaultMarketAllocationsProps = {
  totalAssets?: bigint;
  collateralAllocations: CollateralAllocation[];
  marketAllocations: MarketAllocation[];
  vaultAssetSymbol: string;
  vaultAssetDecimals: number;
  chainId: SupportedNetworks;
  isLoading: boolean;
  needsInitialization?: boolean;
};

type ViewMode = 'collateral' | 'market';

function ViewIcon({ isSelected, className }: { isSelected?: boolean; className?: string }) {
  return isSelected ? <HiOutlineCube className={className} /> : <MdOutlineAccountBalance className={className} />;
}

export function VaultMarketAllocations({
  totalAssets,
  collateralAllocations,
  marketAllocations,
  vaultAssetSymbol,
  vaultAssetDecimals,
  chainId,
  isLoading,
  needsInitialization = false,
}: VaultMarketAllocationsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('market');
  const { loading: marketsLoading } = useMarkets();

  // Calculate total allocation from market allocations (canonical source)
  // Note: collateralAllocations and marketAllocations are different VIEWS of the same data
  // Using marketAllocations as the source of truth to avoid double-counting
  const totalAllocation = useMemo(() => {
    if (totalAssets !== undefined) return totalAssets;

    // Sum only marketAllocations - collateral view is just a different grouping of the same data
    return marketAllocations.reduce((sum, a) => sum + a.allocation, 0n);
  }, [totalAssets, marketAllocations]);

  const hasAnyAllocations = useMemo(() => totalAllocation > 0n, [totalAllocation]);

  const viewDescription = useMemo(() => {
    if (viewMode === 'collateral') {
      return `See how your ${vaultAssetSymbol} supply is collateralized across assets shared by multiple markets.`;
    }
    return `See where your ${vaultAssetSymbol} supply is deployed across markets.`;
  }, [viewMode, vaultAssetSymbol]);

  // Show loading state when either allocations or markets context is still loading
  if (isLoading || marketsLoading) {
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

  const hasNoAllocations = collateralAllocations.length === 0 && marketAllocations.length === 0;

  const headerActions = (
    <div className="flex items-center gap-3">
      <span className="text-xs text-secondary">{viewMode === 'collateral' ? 'By Collateral' : 'By Market'}</span>
      <IconSwitch
        defaultSelected={viewMode === 'market'}
        size="sm"
        color="primary"
        classNames={{
          wrapper: 'mx-0',
          thumbIcon: 'p-0 mr-0',
        }}
        onChange={() => setViewMode(viewMode === 'collateral' ? 'market' : 'collateral')}
        thumbIcon={ViewIcon}
      />
    </div>
  );

  return (
    <TableContainerWithDescription
      title={hasAnyAllocations ? 'Active Allocations' : 'Market Configuration'}
      description={viewDescription}
      actions={headerActions}
    >
      {hasNoAllocations ? (
        <div className="p-10 flex flex-col items-center justify-center font-zen">
          <p className="text-sm text-center text-secondary">
            {needsInitialization
              ? 'Finish the vault setup to configure market caps'
              : 'No markets configured yet. Configure caps in settings to start allocating assets'}
          </p>
        </div>
      ) : viewMode === 'collateral' ? (
        <CollateralView
          allocations={collateralAllocations}
          totalAllocation={totalAllocation}
          vaultAssetSymbol={vaultAssetSymbol}
          vaultAssetDecimals={vaultAssetDecimals}
          chainId={chainId}
        />
      ) : (
        <MarketView
          allocations={marketAllocations}
          totalAllocation={totalAllocation}
          vaultAssetSymbol={vaultAssetSymbol}
          vaultAssetDecimals={vaultAssetDecimals}
          chainId={chainId}
        />
      )}
    </TableContainerWithDescription>
  );
}

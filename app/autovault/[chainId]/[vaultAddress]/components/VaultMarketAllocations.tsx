import { useMemo, useState } from 'react';
import { Switch } from '@heroui/react';
import { HiOutlineCube } from 'react-icons/hi';
import { MdOutlineAccountBalance } from 'react-icons/md';
import { Spinner } from '@/components/common/Spinner';
import { CollateralAllocation, MarketAllocation } from '@/types/vaultAllocations';
import { SupportedNetworks } from '@/utils/networks';
import { CollateralView } from './allocations/CollateralView';
import { MarketView } from './allocations/MarketView';

type VaultMarketAllocationsProps = {
  totalAssets?: bigint;
  collateralAllocations: CollateralAllocation[];
  marketAllocations: MarketAllocation[];
  vaultAssetSymbol: string;
  vaultAssetDecimals: number;
  chainId: SupportedNetworks;
  isLoading: boolean;
};

type ViewMode = 'collateral' | 'market';

function ViewIcon({ isSelected, className }: { isSelected: boolean; className?: string }) {
  return isSelected ? (
    <HiOutlineCube className={className} />
  ) : (
    <MdOutlineAccountBalance className={className} />
  );
}

export function VaultMarketAllocations({
  totalAssets,
  collateralAllocations,
  marketAllocations,
  vaultAssetSymbol,
  vaultAssetDecimals,
  chainId,
  isLoading,
}: VaultMarketAllocationsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('market');

  // Calculate total allocation from all allocations
  const totalAllocation = useMemo(() => {
    if (totalAssets !== undefined) return totalAssets;

    const collateralTotal = collateralAllocations.reduce((sum, a) => sum + a.allocation, 0n);
    const marketTotal = marketAllocations.reduce((sum, a) => sum + a.allocation, 0n);
    return collateralTotal + marketTotal;
  }, [totalAssets, collateralAllocations, marketAllocations]);

  const hasAnyAllocations = useMemo(() => totalAllocation > 0n, [totalAllocation]);

  const viewDescription = useMemo(() => {
    if (viewMode === 'collateral') {
      return `See how your ${vaultAssetSymbol} supply is collateralized across assets shared by multiple markets.`;
    }
    return `See where your ${vaultAssetSymbol} supply is deployed across markets.`;
  }, [viewMode, vaultAssetSymbol]);

  if (isLoading) {
    return (
      <div className="bg-surface rounded p-6 flex items-center justify-center font-zen">
        <Spinner size={24} />
      </div>
    );
  }

  if (collateralAllocations.length === 0 && marketAllocations.length === 0) {
    return (
      <div className="bg-surface rounded p-6 text-center font-zen text-secondary">
        No markets configured yet. Configure caps in settings to start allocating assets.
      </div>
    );
  }

  return (
    <div className="bg-surface rounded p-6 shadow-sm font-zen">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-lg font-medium">
              {hasAnyAllocations ? 'Active Allocations' : 'Market Configuration'}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-secondary">
                {viewMode === 'collateral' ? 'By Collateral' : 'By Market'}
              </span>
              <Switch
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
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            {viewDescription}
          </p>
        </div>
      </div>
      {/* Content */}
      {viewMode === 'collateral' ? (
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
    </div>
  );
}

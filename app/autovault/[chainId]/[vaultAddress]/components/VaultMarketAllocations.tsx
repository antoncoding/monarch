import { useMemo, useState } from 'react';
import { Switch } from '@heroui/react';
import { HiOutlineCube } from 'react-icons/hi';
import { MdOutlineAccountBalance } from 'react-icons/md';
import { Spinner } from '@/components/common/Spinner';
import { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { AllocationData } from '@/hooks/useAllocations';
import { useMarkets } from '@/hooks/useMarkets';
import { parseCapIdParams } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { CollateralView } from './allocations/CollateralView';
import { MarketView } from './allocations/MarketView';

type VaultMarketAllocationsProps = {
  totalAssets?: bigint
  marketCaps: VaultV2Cap[];
  collateralCaps: VaultV2Cap[];
  allocations: AllocationData[];
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
  marketCaps,
  collateralCaps,
  allocations,
  vaultAssetSymbol,
  vaultAssetDecimals,
  chainId,
  isLoading,
}: VaultMarketAllocationsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('collateral');
  const { markets } = useMarkets();

  // Create a map of capId -> allocation amount
  const allocationMap = useMemo(() => {
    const map = new Map<string, bigint>();
    allocations.forEach((alloc) => {
      map.set(alloc.capId, alloc.allocation);
    });
    return map;
  }, [allocations]);

  // Prepare collateral data
  const collateralData = useMemo(() => {
    return collateralCaps
      .map((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        if (!parsed.collateralToken) return null;

        const collateralToken = findToken(parsed.collateralToken, chainId);
        const allocation = allocationMap.get(cap.capId) ?? 0n;

        return {
          collateralAddress: parsed.collateralToken,
          collateralSymbol: collateralToken?.symbol ?? 'Unknown',
          allocation,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [collateralCaps, allocationMap, chainId]);

  // Prepare market data
  const marketData = useMemo(() => {
    return marketCaps
      .map((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        if (parsed.type !== 'market' || !parsed.marketId) return null;

        const market = markets.find((m) => m.uniqueKey.toLowerCase() === parsed.marketId?.toLowerCase());
        if (!market) return null;

        const allocation = allocationMap.get(cap.capId) ?? 0n;

        return {
          market,
          allocation,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [marketCaps, markets, allocationMap]);

   const totalAllocation = useMemo(() => {
    return totalAssets ?? allocations.reduce((sum, allocation) => sum + allocation.allocation, 0n)
   }, [totalAssets, allocations])

   const hasAnyAllocations = useMemo(() => totalAllocation > 0n, [totalAllocation])

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

  if (collateralData.length === 0 && marketData.length === 0) {
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
          items={collateralData}
          totalAllocation={totalAllocation}
          vaultAssetSymbol={vaultAssetSymbol}
          vaultAssetDecimals={vaultAssetDecimals}
          chainId={chainId}
        />
      ) : (
        <MarketView
          items={marketData}
          totalAllocation={totalAllocation}
          vaultAssetSymbol={vaultAssetSymbol}
          vaultAssetDecimals={vaultAssetDecimals}
          chainId={chainId}
        />
      )}
    </div>
  );
}

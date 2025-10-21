import { useMemo, useState } from 'react';
import { Address } from 'viem';
import { Spinner } from '@/components/common/Spinner';
import { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { AllocationData } from '@/hooks/useAllocations';
import { useMarkets } from '@/hooks/useMarkets';
import { parseCapIdParams } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';
import { SupportedNetworks } from '@/utils/networks';
import { CollateralView } from './allocations/CollateralView';
import { MarketView } from './allocations/MarketView';
import { formatBalance } from '@/utils/balance';

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
   }, [totalAssets]) 

   const hasAnyAllocations = useMemo(() => totalAllocation > 0n, [totalAllocation])

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
        <div>
          <p className="text-lg font-medium">
            {hasAnyAllocations ? 'Active Allocations' : 'Market Configuration'}
          </p>
          <p className="text-xs text-secondary mt-1">
            {hasAnyAllocations
              ? 'Current asset distribution across markets'
              : 'Markets are configured but no assets have been allocated yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded bg-hovered px-3 py-1 text-xs uppercase text-secondary">
            Asset: {vaultAssetSymbol}
          </div>
          {hasAnyAllocations && (
            <div className="rounded bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Total: {formatBalance(totalAssets ?? 0n, vaultAssetDecimals)} {vaultAssetSymbol}
            </div>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('collateral')}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'collateral'
              ? 'bg-primary/15 text-primary'
              : 'bg-hovered text-secondary hover:bg-hovered/70'
          }`}
        >
          By Collateral
        </button>
        <button
          type="button"
          onClick={() => setViewMode('market')}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'market'
              ? 'bg-primary/15 text-primary'
              : 'bg-hovered text-secondary hover:bg-hovered/70'
          }`}
        >
          By Market
        </button>
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

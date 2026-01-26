import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon } from '@radix-ui/react-icons';
import { toast } from 'react-toastify';
import { type Address, parseUnits, maxUint128 } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import type { CapData } from '@/hooks/useVaultV2Data';
import { getMarketCapId, getCollateralCapId, getAdapterCapId, parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { AddMarketCapModal } from './AddMarketCapModal';
import { MarketCapsTable } from './MarketCapsTable';

type EditCapsProps = {
  existingCaps?: CapData;
  vaultAsset?: Address;
  chainId: SupportedNetworks;
  isOwner: boolean;
  isUpdating: boolean;
  adapterAddress?: Address;
  onCancel: () => void;
  onSave: (caps: VaultV2Cap[]) => Promise<boolean>;
};

type MarketCapInfo = {
  market: Market;
  relativeCap: string;
  absoluteCap: string;
  existingCapId?: string;
};

export function EditCaps({ existingCaps, vaultAsset, chainId, isOwner, isUpdating, adapterAddress, onCancel, onSave }: EditCapsProps) {
  const [marketCaps, setMarketCaps] = useState<Map<string, MarketCapInfo>>(new Map());
  const [removedMarketIds, setRemovedMarketIds] = useState<Set<string>>(new Set());
  const [showAddMarketModal, setShowAddMarketModal] = useState(false);

  // Track if user has made edits to prevent state reset from background refetches
  const hasUserEditsRef = useRef(false);

  const { markets, loading: marketsLoading } = useProcessedMarkets();
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });
  const { findToken } = useTokensQuery();

  // Get vault asset decimals and token
  const vaultAssetToken = useMemo(() => {
    if (!vaultAsset) return undefined;
    return findToken(vaultAsset, chainId);
  }, [vaultAsset, chainId, findToken]);

  const vaultAssetDecimals = vaultAssetToken?.decimals ?? 18;

  // Build read-only collateral cap lookup from existing on-chain data
  // Used to compute effective caps and show constraint indicators
  const collateralCapMap = useMemo(() => {
    const capMap = new Map<string, { relativeCap: number; absoluteCap: string }>();
    for (const cap of existingCaps?.collateralCaps ?? []) {
      const parsed = parseCapIdParams(cap.idParams);
      if (parsed.collateralToken) {
        capMap.set(parsed.collateralToken.toLowerCase(), {
          relativeCap: Number(cap.relativeCap) / 1e16,
          absoluteCap: cap.absoluteCap,
        });
      }
    }
    return capMap;
  }, [existingCaps]);

  // Filter available markets for adding
  const availableMarkets = useMemo(() => {
    if (!markets || !vaultAsset) return [];
    return markets.filter((m) => m.loanAsset.address.toLowerCase() === vaultAsset.toLowerCase() && m.morphoBlue.chain.id === chainId);
  }, [markets, vaultAsset, chainId]);

  // Initialize from existing caps (only on first load, not after user edits)
  useEffect(() => {
    // Don't reset state if user has made edits - prevents losing work on background refetch
    if (hasUserEditsRef.current) return;
    if (availableMarkets.length === 0) return;

    const marketCapsMap = new Map<string, MarketCapInfo>();
    for (const cap of existingCaps?.marketCaps ?? []) {
      const parsed = parseCapIdParams(cap.idParams);
      const market = availableMarkets.find((m) => m.uniqueKey.toLowerCase() === parsed.marketId?.toLowerCase());
      if (market) {
        const relativeCapBigInt = BigInt(cap.relativeCap);
        const relativeCap = (Number(relativeCapBigInt) / 1e16).toString();

        const absoluteCapBigInt = BigInt(cap.absoluteCap);
        const absoluteCap =
          absoluteCapBigInt === 0n || absoluteCapBigInt >= maxUint128
            ? ''
            : (Number(absoluteCapBigInt) / 10 ** vaultAssetDecimals).toString();

        marketCapsMap.set(market.uniqueKey.toLowerCase(), {
          market,
          relativeCap,
          absoluteCap,
          existingCapId: cap.capId,
        });
      }
    }
    setMarketCaps(marketCapsMap);
  }, [availableMarkets, existingCaps, vaultAssetDecimals]);

  const handleAddMarkets = useCallback((newMarkets: Market[]) => {
    hasUserEditsRef.current = true;
    setMarketCaps((prev) => {
      const next = new Map(prev);
      for (const market of newMarkets) {
        next.set(market.uniqueKey.toLowerCase(), {
          market,
          relativeCap: '100',
          absoluteCap: '',
        });
      }
      return next;
    });
  }, []);

  const handleUpdateMarketCap = useCallback((marketId: string, field: 'relativeCap' | 'absoluteCap', value: string) => {
    hasUserEditsRef.current = true;
    setMarketCaps((prev) => {
      const next = new Map(prev);
      const existing = next.get(marketId.toLowerCase());
      if (existing) {
        next.set(marketId.toLowerCase(), { ...existing, [field]: value });
      }
      return next;
    });
  }, []);

  const handleRemoveMarketCap = useCallback((marketId: string) => {
    hasUserEditsRef.current = true;
    const key = marketId.toLowerCase();
    let wasNewCap = false;

    setMarketCaps((prev) => {
      const info = prev.get(key);
      if (info && !info.existingCapId) {
        // Newly added cap — remove from state entirely
        wasNewCap = true;
        const next = new Map(prev);
        next.delete(key);
        return next;
      }
      return prev;
    });

    // Existing on-chain cap — mark as removed (will be zeroed on save)
    if (!wasNewCap) {
      setRemovedMarketIds((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  }, []);

  const handleUndoRemoveMarketCap = useCallback((marketId: string) => {
    setRemovedMarketIds((prev) => {
      const next = new Set(prev);
      next.delete(marketId.toLowerCase());
      return next;
    });
  }, []);

  const handleCancel = useCallback(() => {
    hasUserEditsRef.current = false;
    onCancel();
  }, [onCancel]);

  const hasChanges = useMemo(() => {
    const hasNewMarkets = Array.from(marketCaps.values()).some((m) => !m.existingCapId);
    const hasRemovedMarkets = removedMarketIds.size > 0;

    const hasModifiedMarkets = Array.from(marketCaps.values()).some((info) => {
      if (!info.existingCapId) return false;
      const existing = existingCaps?.marketCaps.find((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        return parsed.marketId?.toLowerCase() === info.market.uniqueKey.toLowerCase();
      });
      if (!existing) return false;
      const existingRelative = (Number(BigInt(existing.relativeCap)) / 1e16).toString();
      const existingAbsoluteBigInt = BigInt(existing.absoluteCap);
      const existingAbsolute =
        existingAbsoluteBigInt === 0n || existingAbsoluteBigInt >= maxUint128
          ? ''
          : (Number(existingAbsoluteBigInt) / 10 ** vaultAssetDecimals).toString();
      return info.relativeCap !== existingRelative || info.absoluteCap !== existingAbsolute;
    });

    return hasNewMarkets || hasModifiedMarkets || hasRemovedMarkets;
  }, [marketCaps, removedMarketIds, existingCaps, vaultAssetDecimals]);

  const handleSave = useCallback(async () => {
    if (needSwitchChain) {
      switchToNetwork();
      return;
    }

    if (!adapterAddress || !vaultAsset) {
      toast.error('Unable to save: vault data not loaded');
      return;
    }

    const capsToUpdate: VaultV2Cap[] = [];

    // Add or fix adapter cap to ensure it's always 100% relative + maxUint128 absolute
    const targetRelativeCap = parseUnits('100', 16);
    const targetAbsoluteCap = maxUint128;

    const currentRelativeCap = existingCaps?.adapterCap ? BigInt(existingCaps.adapterCap.relativeCap) : 0n;
    const currentAbsoluteCap = existingCaps?.adapterCap ? BigInt(existingCaps.adapterCap.absoluteCap) : 0n;

    // Only update if not already at target values
    if (currentRelativeCap !== targetRelativeCap || currentAbsoluteCap !== targetAbsoluteCap) {
      const { params, id } = getAdapterCapId(adapterAddress);
      capsToUpdate.push({
        capId: id,
        idParams: params,
        relativeCap: targetRelativeCap.toString(),
        absoluteCap: targetAbsoluteCap.toString(),
        oldRelativeCap: currentRelativeCap.toString(),
        oldAbsoluteCap: currentAbsoluteCap.toString(),
      });
    }

    // Auto-derive collateral caps from active market caps
    // Collect active collateral addresses from non-removed market caps
    const activeCollaterals = new Set<string>();
    for (const [key, info] of marketCaps.entries()) {
      if (!removedMarketIds.has(key)) {
        activeCollaterals.add(info.market.collateralAsset.address.toLowerCase());
      }
    }

    // Ensure each active collateral has max caps
    for (const collateralAddr of activeCollaterals) {
      const existing = existingCaps?.collateralCaps.find((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        return parsed.collateralToken?.toLowerCase() === collateralAddr;
      });

      const oldRelativeCap = existing ? BigInt(existing.relativeCap) : 0n;
      const oldAbsoluteCap = existing ? BigInt(existing.absoluteCap) : 0n;

      if (oldRelativeCap !== targetRelativeCap || oldAbsoluteCap !== targetAbsoluteCap) {
        const { params, id } = getCollateralCapId(collateralAddr as Address);
        capsToUpdate.push({
          capId: id,
          idParams: params,
          relativeCap: targetRelativeCap.toString(),
          absoluteCap: targetAbsoluteCap.toString(),
          oldRelativeCap: oldRelativeCap.toString(),
          oldAbsoluteCap: oldAbsoluteCap.toString(),
        });
      }
    }

    // Zero out collateral caps for collaterals with no active markets
    for (const cap of existingCaps?.collateralCaps ?? []) {
      const parsed = parseCapIdParams(cap.idParams);
      const addr = parsed.collateralToken?.toLowerCase();
      if (addr && !activeCollaterals.has(addr)) {
        const oldRelativeCap = BigInt(cap.relativeCap);
        const oldAbsoluteCap = BigInt(cap.absoluteCap);

        if (oldRelativeCap !== 0n || oldAbsoluteCap !== 0n) {
          const { params, id } = getCollateralCapId(addr as Address);
          capsToUpdate.push({
            capId: id,
            idParams: params,
            relativeCap: '0',
            absoluteCap: '0',
            oldRelativeCap: oldRelativeCap.toString(),
            oldAbsoluteCap: oldAbsoluteCap.toString(),
          });
        }
      }
    }

    // Add market caps with delta calculation (handles both active and removed)
    for (const [key, info] of marketCaps.entries()) {
      const isRemoved = removedMarketIds.has(key);

      // Skip newly-added-then-removed caps (nothing to zero out on-chain)
      if (isRemoved && !info.existingCapId) continue;

      let newRelativeCapBigInt = 0n;
      let newAbsoluteCapBigInt = 0n;

      if (!isRemoved) {
        const relativeVal = Number.parseFloat(info.relativeCap);
        if (info.relativeCap !== '' && relativeVal > 0) {
          newRelativeCapBigInt = parseUnits(info.relativeCap, 16);
        }

        const absoluteVal = Number.parseFloat(info.absoluteCap);
        if (info.absoluteCap !== '' && absoluteVal > 0) {
          newAbsoluteCapBigInt = parseUnits(info.absoluteCap, vaultAssetDecimals);
        } else {
          newAbsoluteCapBigInt = maxUint128;
        }
      }

      // Find existing cap to calculate delta
      const existingCap = existingCaps?.marketCaps.find((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        return parsed.marketId?.toLowerCase() === info.market.uniqueKey.toLowerCase();
      });

      const oldRelativeCap = existingCap ? BigInt(existingCap.relativeCap) : 0n;
      const oldAbsoluteCap = existingCap ? BigInt(existingCap.absoluteCap) : 0n;

      // Only include if changed
      if (oldRelativeCap !== newRelativeCapBigInt || oldAbsoluteCap !== newAbsoluteCapBigInt) {
        const marketParams = {
          loanToken: info.market.loanAsset.address as Address,
          collateralToken: info.market.collateralAsset.address as Address,
          oracle: info.market.oracleAddress as Address,
          irm: info.market.irmAddress as Address,
          lltv: BigInt(info.market.lltv),
        };

        const { params, id } = getMarketCapId(adapterAddress, marketParams);

        capsToUpdate.push({
          capId: id,
          idParams: params,
          relativeCap: newRelativeCapBigInt.toString(),
          absoluteCap: newAbsoluteCapBigInt.toString(),
          oldRelativeCap: oldRelativeCap.toString(),
          oldAbsoluteCap: oldAbsoluteCap.toString(),
        });
      }
    }

    if (capsToUpdate.length === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      const success = await onSave(capsToUpdate);
      if (success) {
        hasUserEditsRef.current = false;
        setRemovedMarketIds(new Set());
      } else {
        toast.error('Failed to save changes');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes');
    }
  }, [
    marketCaps,
    removedMarketIds,
    needSwitchChain,
    switchToNetwork,
    onSave,
    adapterAddress,
    vaultAsset,
    vaultAssetDecimals,
    existingCaps,
  ]);

  if (marketsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  const existingMarketIds = new Set(Array.from(marketCaps.keys()).filter((key) => !removedMarketIds.has(key)));

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Edit Allocation Caps</p>
            <p className="text-xs text-secondary">Define limits for how agents can allocate vault funds across markets.</p>
          </div>
        </div>

        {/* Adapter Cap Warning */}
        {(() => {
          const hasAdapterCap = !!existingCaps?.adapterCap;
          const hasOtherCaps = (existingCaps?.collateralCaps?.length ?? 0) > 0 || (existingCaps?.marketCaps?.length ?? 0) > 0;

          // No warning when user has no caps at all (fresh state)
          if (!hasOtherCaps && !hasAdapterCap) return null;

          if (!hasAdapterCap) {
            return (
              <div className="rounded bg-warning/10 border border-warning/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-warning mt-0.5">⚠</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-warning">Adapter Not Authorized</h4>
                    <p className="text-xs text-secondary mt-1">
                      The Morpho Market V1 adapter is not authorized to allocate funds in this vault. This will result in all funds
                      remaining idle until the adapter cap is configured.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          const relativeCapBigInt = BigInt(existingCaps.adapterCap!.relativeCap);
          const absoluteCapBigInt = BigInt(existingCaps.adapterCap!.absoluteCap);
          const isFullyAuthorized = relativeCapBigInt >= parseUnits('100', 16) && absoluteCapBigInt >= maxUint128;

          if (!isFullyAuthorized) {
            const relativeCapPercent = (Number(relativeCapBigInt) / 1e16).toFixed(2);
            return (
              <div className="rounded bg-warning/10 border border-warning/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-warning mt-0.5">⚠</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-warning">Adapter Partially Authorized</h4>
                    <p className="text-xs text-secondary mt-1">
                      The Morpho Market V1 adapter is limited to {relativeCapPercent}% of vault funds. This may result in idle funds that
                      cannot be allocated to markets. Consider setting the adapter cap to 100% with no absolute limit for optimal capital
                      efficiency.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })()}

        {/* Market Caps Section */}
        {marketCaps.size > 0 && (
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs uppercase text-secondary">Market Caps ({marketCaps.size - removedMarketIds.size})</p>
              <p className="text-xs text-secondary">Individual limits per market for how agents can allocate vault funds.</p>
            </div>

            {/* Column Headers */}
            <div className="flex items-center gap-2 pb-1 text-xs font-medium text-secondary">
              <div className="flex-1">Market</div>
              <div className="w-32 text-right">Relative %</div>
              <div className="w-36 text-right">Absolute ({vaultAssetToken?.symbol ?? 'units'})</div>
              {isOwner && <div className="w-6 shrink-0" />}
            </div>

            <MarketCapsTable
              markets={Array.from(marketCaps.values()).map((info) => {
                const collateralAddr = info.market.collateralAsset.address.toLowerCase();
                const collateralInfo = collateralCapMap.get(collateralAddr);
                return {
                  market: info.market,
                  relativeCap: info.relativeCap,
                  absoluteCap: info.absoluteCap,
                  isEditable: true,
                  isNew: !info.existingCapId,
                  isRemoved: removedMarketIds.has(info.market.uniqueKey.toLowerCase()),
                  collateralCapPercent: collateralInfo?.relativeCap,
                  onUpdateCap: (field, value) => handleUpdateMarketCap(info.market.uniqueKey, field, value),
                  onRemove: () => handleRemoveMarketCap(info.market.uniqueKey),
                  onUndoRemove: () => handleUndoRemoveMarketCap(info.market.uniqueKey),
                };
              })}
              showHeaders={false}
              vaultAssetSymbol={vaultAssetToken?.symbol}
              vaultAssetAddress={vaultAsset}
              chainId={chainId}
              isOwner={isOwner}
            />
          </div>
        )}

        {/* Add Market Button */}
        <div className="flex items-center justify-center">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowAddMarketModal(true)}
            disabled={!isOwner}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Market Cap
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-divider/30 pt-4">
          <div />
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!hasChanges || isUpdating}
              onClick={() => void handleSave()}
            >
              {(() => {
                if (isUpdating) {
                  return (
                    <span className="flex items-center gap-2">
                      <Spinner size={12} /> Saving...
                    </span>
                  );
                }
                if (needSwitchChain) return 'Switch Network';
                return 'Save Changes';
              })()}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Market Modal */}
      {showAddMarketModal && vaultAsset && (
        <AddMarketCapModal
          vaultAsset={vaultAsset}
          chainId={chainId}
          existingMarketIds={existingMarketIds}
          onOpenChange={setShowAddMarketModal}
          onAdd={handleAddMarkets}
        />
      )}
    </>
  );
}

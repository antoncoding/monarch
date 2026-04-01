import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon } from '@radix-ui/react-icons';
import { toast } from 'react-toastify';
import { type Address, parseUnits, maxUint128 } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import type { VaultV2Cap } from '@/data-sources/monarch-api/vaults';
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
  onBack: () => void;
  onSave: (caps: VaultV2Cap[]) => Promise<boolean>;
};

type MarketCapInfo = {
  market: Market;
  relativeCap: string;
  absoluteCap: string;
  existingCapId?: string;
};

function normalizeAddress(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.toLowerCase();
}

function parseBigIntOrFallback(value: string | null | undefined, fallback: bigint, context: string): bigint {
  if (value == null || value === '') return fallback;

  try {
    return BigInt(value);
  } catch (error) {
    console.error('[EditCaps] invalid bigint value', {
      context,
      value,
      error,
    });
    return fallback;
  }
}

function hasCompleteEditableMarketMetadata(market: Market): boolean {
  return (
    normalizeAddress(market.loanAsset?.address) !== null &&
    normalizeAddress(market.collateralAsset?.address) !== null &&
    normalizeAddress(market.oracleAddress) !== null &&
    normalizeAddress(market.irmAddress) !== null &&
    market.lltv !== undefined &&
    market.lltv !== ''
  );
}

function areMarketCapsEqual(left: Map<string, MarketCapInfo>, right: Map<string, MarketCapInfo>): boolean {
  if (left.size !== right.size) return false;

  for (const [key, leftValue] of left.entries()) {
    const rightValue = right.get(key);
    if (!rightValue) return false;

    if (
      leftValue.market.uniqueKey !== rightValue.market.uniqueKey ||
      leftValue.relativeCap !== rightValue.relativeCap ||
      leftValue.absoluteCap !== rightValue.absoluteCap ||
      leftValue.existingCapId !== rightValue.existingCapId
    ) {
      return false;
    }
  }

  return true;
}

export function EditCaps({ existingCaps, vaultAsset, chainId, isOwner, isUpdating, adapterAddress, onBack, onSave }: EditCapsProps) {
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
    const normalizedVaultAsset = normalizeAddress(vaultAsset);
    if (!markets || !normalizedVaultAsset) return [];

    return markets.filter((market) => {
      return normalizeAddress(market.loanAsset?.address) === normalizedVaultAsset && market.morphoBlue.chain.id === chainId;
    });
  }, [markets, vaultAsset, chainId]);

  const initialMarketCaps = useMemo(() => {
    const marketCapsMap = new Map<string, MarketCapInfo>();
    for (const cap of existingCaps?.marketCaps ?? []) {
      const parsed = parseCapIdParams(cap.idParams);
      const market = availableMarkets.find((m) => m.uniqueKey.toLowerCase() === parsed.marketId?.toLowerCase());
      if (market) {
        if (!hasCompleteEditableMarketMetadata(market)) {
          console.error('[EditCaps] skipping market cap with incomplete market metadata', {
            marketUniqueKey: market.uniqueKey,
            capId: cap.capId,
          });
          continue;
        }

        const relativeCapBigInt = parseBigIntOrFallback(cap.relativeCap, 0n, `market:${cap.capId}:relativeCap`);
        const relativeCap = (Number(relativeCapBigInt) / 1e16).toString();

        const absoluteCapBigInt = parseBigIntOrFallback(cap.absoluteCap, maxUint128, `market:${cap.capId}:absoluteCap`);
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
    return marketCapsMap;
  }, [availableMarkets, existingCaps, vaultAssetDecimals]);

  // Initialize from existing caps (only on first load, not after user edits)
  useEffect(() => {
    // Don't reset state if user has made edits - prevents losing work on background refetch
    if (hasUserEditsRef.current) return;

    setMarketCaps((prev) => {
      if (areMarketCapsEqual(prev, initialMarketCaps)) {
        return prev;
      }

      console.debug('[EditCaps] syncing initial market caps', {
        previousSize: prev.size,
        nextSize: initialMarketCaps.size,
      });

      return initialMarketCaps;
    });
  }, [initialMarketCaps]);

  const handleAddMarkets = useCallback((newMarkets: Market[]) => {
    const validMarkets = newMarkets.filter(hasCompleteEditableMarketMetadata);
    const skippedCount = newMarkets.length - validMarkets.length;

    if (skippedCount > 0) {
      console.error('[EditCaps] skipped markets with incomplete metadata while adding caps', {
        skippedCount,
        skippedMarketKeys: newMarkets.filter((market) => !hasCompleteEditableMarketMetadata(market)).map((market) => market.uniqueKey),
      });
      toast.error('Some selected markets are missing metadata and could not be added to caps.');
    }

    if (validMarkets.length === 0) return;

    hasUserEditsRef.current = true;
    setMarketCaps((prev) => {
      const next = new Map(prev);
      for (const market of validMarkets) {
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

    setMarketCaps((prev) => {
      const info = prev.get(key);
      if (!info) return prev;

      if (!info.existingCapId) {
        // Newly added cap — remove from state entirely
        const next = new Map(prev);
        next.delete(key);
        return next;
      }

      // Existing on-chain cap — mark as removed (will be zeroed on save)
      setRemovedMarketIds((prevRemoved) => new Set(prevRemoved).add(key));
      return prev;
    });
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
    onBack();
  }, [onBack]);

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
      const existingRelative = (
        Number(parseBigIntOrFallback(existing.relativeCap, 0n, `market:${existing.capId}:relativeCap:compare`)) / 1e16
      ).toString();
      const existingAbsoluteBigInt = parseBigIntOrFallback(
        existing.absoluteCap,
        maxUint128,
        `market:${existing.capId}:absoluteCap:compare`,
      );
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

    const currentRelativeCap = existingCaps?.adapterCap
      ? parseBigIntOrFallback(existingCaps.adapterCap.relativeCap, 0n, `adapter:${existingCaps.adapterCap.capId}:relativeCap`)
      : 0n;
    const currentAbsoluteCap = existingCaps?.adapterCap
      ? parseBigIntOrFallback(existingCaps.adapterCap.absoluteCap, 0n, `adapter:${existingCaps.adapterCap.capId}:absoluteCap`)
      : 0n;

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
        const collateralAddress = normalizeAddress(info.market.collateralAsset?.address);
        if (!collateralAddress) {
          console.error('[EditCaps] cannot save caps for market with missing collateral address', {
            marketUniqueKey: info.market.uniqueKey,
          });
          toast.error('Unable to save caps because one market is missing collateral metadata.');
          return;
        }

        activeCollaterals.add(collateralAddress);
      }
    }

    // Ensure each active collateral has max caps
    for (const collateralAddr of activeCollaterals) {
      const existing = existingCaps?.collateralCaps.find((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        return parsed.collateralToken?.toLowerCase() === collateralAddr;
      });

      const oldRelativeCap = existing ? parseBigIntOrFallback(existing.relativeCap, 0n, `collateral:${existing.capId}:relativeCap`) : 0n;
      const oldAbsoluteCap = existing ? parseBigIntOrFallback(existing.absoluteCap, 0n, `collateral:${existing.capId}:absoluteCap`) : 0n;

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
        const oldRelativeCap = parseBigIntOrFallback(cap.relativeCap, 0n, `collateral:${cap.capId}:relativeCap:remove`);
        const oldAbsoluteCap = parseBigIntOrFallback(cap.absoluteCap, 0n, `collateral:${cap.capId}:absoluteCap:remove`);

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

      const oldRelativeCap = existingCap
        ? parseBigIntOrFallback(existingCap.relativeCap, 0n, `market:${existingCap.capId}:relativeCap:save`)
        : 0n;
      const oldAbsoluteCap = existingCap
        ? parseBigIntOrFallback(existingCap.absoluteCap, 0n, `market:${existingCap.capId}:absoluteCap:save`)
        : 0n;

      // Only include if changed
      if (oldRelativeCap !== newRelativeCapBigInt || oldAbsoluteCap !== newAbsoluteCapBigInt) {
        if (!hasCompleteEditableMarketMetadata(info.market)) {
          console.error('[EditCaps] cannot save cap for market with incomplete metadata', {
            marketUniqueKey: info.market.uniqueKey,
            capId: existingCap?.capId,
          });
          toast.error('Unable to save caps because one market is missing required metadata.');
          return;
        }

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

          const relativeCapBigInt = parseBigIntOrFallback(
            existingCaps.adapterCap!.relativeCap,
            0n,
            `adapter:${existingCaps.adapterCap!.capId}:relativeCap:warning`,
          );
          const absoluteCapBigInt = parseBigIntOrFallback(
            existingCaps.adapterCap!.absoluteCap,
            0n,
            `adapter:${existingCaps.adapterCap!.capId}:absoluteCap:warning`,
          );
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
                const collateralAddr = normalizeAddress(info.market.collateralAsset?.address);
                const collateralInfo = collateralAddr ? collateralCapMap.get(collateralAddr) : undefined;
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

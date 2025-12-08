import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlusIcon } from '@radix-ui/react-icons';
import { type Address, parseUnits, maxUint128 } from 'viem';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { useTokens } from '@/components/providers/TokenProvider';
import { TokenIcon } from '@/components/TokenIcon';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useMarkets } from '@/hooks/useMarkets';
import type { CapData } from '@/hooks/useVaultV2Data';
import { getMarketCapId, getCollateralCapId, getAdapterCapId, parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { AddMarketCapModal } from './AddMarketCapModal';
import { MarketCapsTable } from './MarketCapsTable';
import { CollateralCapTooltip, MarketCapTooltip } from './Tooltips';

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

type CollateralCapInfo = {
  collateralAddress: Address;
  collateralSymbol: string;
  relativeCap: string;
  absoluteCap: string;
  existingCapId?: string;
};

type MarketCapInfo = {
  market: Market;
  relativeCap: string;
  absoluteCap: string;
  existingCapId?: string;
};

export function EditCaps({ existingCaps, vaultAsset, chainId, isOwner, isUpdating, adapterAddress, onCancel, onSave }: EditCapsProps) {
  const [marketCaps, setMarketCaps] = useState<Map<string, MarketCapInfo>>(new Map());
  const [collateralCaps, setCollateralCaps] = useState<Map<string, CollateralCapInfo>>(new Map());
  const [showAddMarketModal, setShowAddMarketModal] = useState(false);

  const { markets, loading: marketsLoading } = useMarkets();
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });
  const { findToken } = useTokens();

  // Get vault asset decimals and token
  const vaultAssetToken = useMemo(() => {
    if (!vaultAsset) return undefined;
    return findToken(vaultAsset, chainId);
  }, [vaultAsset, chainId, findToken]);

  const vaultAssetDecimals = vaultAssetToken?.decimals ?? 18;

  // Filter available markets for adding
  const availableMarkets = useMemo(() => {
    if (!markets || !vaultAsset) return [];
    return markets.filter((m) => m.loanAsset.address.toLowerCase() === vaultAsset.toLowerCase() && m.morphoBlue.chain.id === chainId);
  }, [markets, vaultAsset, chainId]);

  // Initialize from existing caps
  useEffect(() => {
    if (availableMarkets.length === 0) return;

    // Initialize collateral caps
    const collateralCapsMap = new Map<string, CollateralCapInfo>();
    existingCaps?.collateralCaps.forEach((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      if (parsed.collateralToken) {
        const token = findToken(parsed.collateralToken, chainId);

        const relativeCapBigInt = BigInt(cap.relativeCap);
        const relativeCap = (Number(relativeCapBigInt) / 1e16).toString();

        const absoluteCapBigInt = BigInt(cap.absoluteCap);
        const absoluteCap =
          absoluteCapBigInt === 0n || absoluteCapBigInt >= maxUint128
            ? ''
            : (Number(absoluteCapBigInt) / 10 ** vaultAssetDecimals).toString();

        collateralCapsMap.set(parsed.collateralToken.toLowerCase(), {
          collateralAddress: parsed.collateralToken,
          collateralSymbol: token?.symbol ?? 'Unknown',
          relativeCap,
          absoluteCap,
          existingCapId: cap.capId,
        });
      }
    });
    setCollateralCaps(collateralCapsMap);

    // Initialize market caps
    const marketCapsMap = new Map<string, MarketCapInfo>();
    existingCaps?.marketCaps.forEach((cap) => {
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
    });
    setMarketCaps(marketCapsMap);
  }, [availableMarkets, chainId, existingCaps, findToken, vaultAssetDecimals]);

  const handleAddMarkets = useCallback((newMarkets: Market[]) => {
    setMarketCaps((prev) => {
      const next = new Map(prev);
      newMarkets.forEach((market) => {
        next.set(market.uniqueKey.toLowerCase(), {
          market,
          relativeCap: '100',
          absoluteCap: '',
        });

        // Auto-create collateral cap if needed
        const collateralAddr = market.collateralAsset.address.toLowerCase();
        setCollateralCaps((prevCaps) => {
          if (!prevCaps.has(collateralAddr)) {
            const newCaps = new Map(prevCaps);
            newCaps.set(collateralAddr, {
              collateralAddress: market.collateralAsset.address as Address,
              collateralSymbol: market.collateralAsset.symbol,
              relativeCap: '100',
              absoluteCap: '',
            });
            return newCaps;
          }
          return prevCaps;
        });
      });
      return next;
    });
  }, []);

  const handleUpdateMarketCap = useCallback((marketId: string, field: 'relativeCap' | 'absoluteCap', value: string) => {
    setMarketCaps((prev) => {
      const next = new Map(prev);
      const existing = next.get(marketId.toLowerCase());
      if (existing) {
        next.set(marketId.toLowerCase(), { ...existing, [field]: value });
      }
      return next;
    });
  }, []);

  const handleUpdateCollateralCap = useCallback((collateralAddr: string, field: 'relativeCap' | 'absoluteCap', value: string) => {
    setCollateralCaps((prev) => {
      const next = new Map(prev);
      const existing = next.get(collateralAddr.toLowerCase());
      if (existing) {
        next.set(collateralAddr.toLowerCase(), {
          ...existing,
          [field]: value,
        });
      }
      return next;
    });
  }, []);

  const hasChanges = useMemo(() => {
    // Check for new caps
    const hasNewMarkets = Array.from(marketCaps.values()).some((m) => !m.existingCapId);
    const hasNewCollaterals = Array.from(collateralCaps.values()).some((c) => !c.existingCapId);

    // Check for modified caps
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

    const hasModifiedCollaterals = Array.from(collateralCaps.values()).some((info) => {
      if (!info.existingCapId) return false;
      const existing = existingCaps?.collateralCaps.find((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        return parsed.collateralToken?.toLowerCase() === info.collateralAddress.toLowerCase();
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

    return hasNewMarkets || hasNewCollaterals || hasModifiedMarkets || hasModifiedCollaterals;
  }, [marketCaps, collateralCaps, existingCaps, vaultAssetDecimals]);

  const handleSave = useCallback(async () => {
    if (needSwitchChain) {
      switchToNetwork();
      return;
    }

    if (!adapterAddress || !vaultAsset) {
      console.error('Adapter address and vault asset are required');
      return;
    }

    const capsToUpdate: VaultV2Cap[] = [];

    // Add adapter cap if it doesn't exist
    if (!existingCaps?.adapterCap && adapterAddress) {
      const { params, id } = getAdapterCapId(adapterAddress);
      capsToUpdate.push({
        capId: id,
        idParams: params,
        relativeCap: parseUnits('100', 16).toString(), // Default 100%
        absoluteCap: maxUint128.toString(), // No limit
        oldRelativeCap: '0',
        oldAbsoluteCap: '0',
      });
    }

    // Add collateral caps with delta calculation (only when changed)
    for (const [, info] of collateralCaps.entries()) {
      const newRelativeCapBigInt =
        info.relativeCap && info.relativeCap !== '' && Number.parseFloat(info.relativeCap) > 0 ? parseUnits(info.relativeCap, 16) : 0n;

      const newAbsoluteCapBigInt =
        info.absoluteCap && info.absoluteCap !== '' && Number.parseFloat(info.absoluteCap) > 0
          ? parseUnits(info.absoluteCap, vaultAssetDecimals)
          : maxUint128;

      // Find existing cap to calculate delta
      const existingCap = existingCaps?.collateralCaps.find((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        return parsed.collateralToken?.toLowerCase() === info.collateralAddress.toLowerCase();
      });

      const oldRelativeCap = existingCap ? BigInt(existingCap.relativeCap) : 0n;
      const oldAbsoluteCap = existingCap ? BigInt(existingCap.absoluteCap) : 0n;

      // Only include if changed
      if (oldRelativeCap !== newRelativeCapBigInt || oldAbsoluteCap !== newAbsoluteCapBigInt) {
        const { params, id } = getCollateralCapId(info.collateralAddress);

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

    // Add market caps with delta calculation (only when changed)
    for (const [, info] of marketCaps.entries()) {
      const newRelativeCapBigInt =
        info.relativeCap && info.relativeCap !== '' && Number.parseFloat(info.relativeCap) > 0 ? parseUnits(info.relativeCap, 16) : 0n;

      const newAbsoluteCapBigInt =
        info.absoluteCap && info.absoluteCap !== '' && Number.parseFloat(info.absoluteCap) > 0
          ? parseUnits(info.absoluteCap, vaultAssetDecimals)
          : maxUint128;

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

    if (capsToUpdate.length === 0) return;

    const success = await onSave(capsToUpdate);
    if (success) {
      // Parent handles switching back to read mode
    }
  }, [marketCaps, collateralCaps, needSwitchChain, switchToNetwork, onSave, adapterAddress, vaultAsset, vaultAssetDecimals, existingCaps]);

  if (marketsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  const existingMarketIds = new Set(Array.from(marketCaps.keys()));

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">Edit Cap Settings</h3>
            <p className="text-xs text-secondary">Modify allocation limits or add new market caps</p>
          </div>
        </div>

        {/* Adapter Cap Warning */}
        {(() => {
          // Check if adapter cap needs attention
          const hasAdapterCap = !!existingCaps?.adapterCap;
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

        {/* Collateral Caps Section */}
        {collateralCaps.size > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <h4 className="text-sm text-secondary">Collateral Caps ({collateralCaps.size})</h4>
              <CollateralCapTooltip />
            </div>

            {/* Column Headers */}
            <div className="flex items-center gap-2 pb-1 text-xs font-medium text-secondary">
              <div className="flex-1">Collateral</div>
              <div className="w-32 text-right">Relative %</div>
              <div className="w-36 text-right">Absolute ({vaultAssetToken?.symbol ?? 'units'})</div>
            </div>

            <div className="space-y-1">
              {Array.from(collateralCaps.values()).map((info) => {
                const isNew = !info.existingCapId;

                return (
                  <div key={info.collateralAddress} className="flex items-center gap-2 text-xs rounded bg-surface py-1 px-2">
                    <TokenIcon address={info.collateralAddress} chainId={chainId} width={20} height={20} />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-medium">{info.collateralSymbol}</span>
                      {isNew && <Badge variant="primary">New</Badge>}
                    </div>
                    <div className="flex items-center gap-1 w-32">
                      <input
                        type="text"
                        value={info.relativeCap}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            const num = Number.parseFloat(val);
                            if (val === '' || (num >= 0 && num <= 100)) {
                              handleUpdateCollateralCap(info.collateralAddress, 'relativeCap', val);
                            }
                          }
                        }}
                        placeholder="100"
                        disabled={!isOwner}
                        className="w-16 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-secondary">%</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateCollateralCap(info.collateralAddress, 'relativeCap', '100')}
                        disabled={!isOwner}
                        className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Max
                      </button>
                    </div>
                    <div className="flex items-center gap-1 w-36">
                      <input
                        type="text"
                        value={info.absoluteCap === maxUint128.toString() ? '' : info.absoluteCap}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            handleUpdateCollateralCap(info.collateralAddress, 'absoluteCap', val);
                          }
                        }}
                        placeholder="No limit"
                        disabled={!isOwner}
                        className="w-24 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateCollateralCap(info.collateralAddress, 'absoluteCap', '')}
                        disabled={!isOwner}
                        className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Market Caps Section */}
        {marketCaps.size > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <h4 className="text-sm text-secondary">Market Caps ({marketCaps.size})</h4>
              <MarketCapTooltip />
            </div>

            {/* Column Headers */}
            <div className="flex items-center gap-2 pb-1 text-xs font-medium text-secondary">
              <div className="flex-1">Market</div>
              <div className="w-32 text-right">Relative %</div>
              <div className="w-36 text-right">Absolute ({vaultAssetToken?.symbol ?? 'units'})</div>
            </div>

            <MarketCapsTable
              markets={Array.from(marketCaps.values()).map((info) => ({
                market: info.market,
                relativeCap: info.relativeCap,
                absoluteCap: info.absoluteCap,
                isEditable: true,
                isNew: !info.existingCapId,
                onUpdateCap: (field, value) => handleUpdateMarketCap(info.market.uniqueKey, field, value),
              }))}
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
          <Button variant="subtle" size="sm" onPress={() => setShowAddMarketModal(true)} isDisabled={!isOwner}>
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Market Cap
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-divider/30 pt-4">
          <div />
          <div className="flex items-center gap-2">
            <Button variant="subtle" size="sm" onPress={onCancel}>
              Cancel
            </Button>
            <Button variant="cta" size="sm" isDisabled={!hasChanges || isUpdating} onPress={() => void handleSave()}>
              {isUpdating ? (
                <span className="flex items-center gap-2">
                  <Spinner size={12} /> Saving...
                </span>
              ) : needSwitchChain ? (
                'Switch Network'
              ) : (
                'Save Changes'
              )}
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

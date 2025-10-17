import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address, parseUnits } from 'viem';
import { Tooltip } from '@heroui/react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/common/Button';
import { MarketsTableWithSameLoanAsset } from '@/components/common/MarketsTableWithSameLoanAsset';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useMarkets } from '@/hooks/useMarkets';
import { useTokens } from '@/components/providers/TokenProvider';
import { getMarketCapId, getCollateralCapId, parseCapIdParams } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { MarketCapState } from './types';
import { CapData } from '@/hooks/useVaultV2Data';
import { CollateralCapTooltip } from './Tooltips';
import { Badge } from '@/components/common/Badge';

type EditAllocationsProps = {
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
  needsCreation: boolean;
};

type MarketCapInfo = {
  market: MarketCapState['market'];
  relativeCap: string;
  absoluteCap: string;
};

const MAX_UINT256 = 2n ** 256n - 1n;

export function EditAllocations({
  existingCaps,
  vaultAsset,
  chainId,
  isOwner,
  isUpdating,
  adapterAddress,
  onCancel,
  onSave
}: EditAllocationsProps) {
  const [selectedMarkets, setSelectedMarkets] = useState<Map<string, MarketCapInfo>>(new Map());
  const [collateralCaps, setCollateralCaps] = useState<Map<string, CollateralCapInfo>>(new Map());
  const { markets, loading: marketsLoading } = useMarkets();
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({ targetChainId: chainId });
  const { findToken } = useTokens();

  // Get vault asset decimals for absolute cap
  const vaultAssetDecimals = useMemo(() => {
    if (!vaultAsset) return 18;
    const token = findToken(vaultAsset, chainId);
    return token?.decimals ?? 18;
  }, [vaultAsset, chainId, findToken]);

  // Filter available markets
  const availableMarkets = useMemo(() => {
    if (!markets || !vaultAsset) return [];
    return markets.filter(
      (m) =>
        m.loanAsset.address.toLowerCase() === vaultAsset.toLowerCase() &&
        m.morphoBlue.chain.id === chainId,
    );
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
        collateralCapsMap.set(parsed.collateralToken.toLowerCase(), {
          collateralAddress: parsed.collateralToken,
          collateralSymbol: token?.symbol ?? 'Unknown',
          relativeCap: (parseFloat(cap.relativeCap) / 1e16).toString(),
          absoluteCap: cap.absoluteCap === '0' ? '' : (Number(cap.absoluteCap) / 10 ** vaultAssetDecimals).toString(),
          needsCreation: false,
        });
      }
    });
    setCollateralCaps(collateralCapsMap);

    // Initialize selected markets
    const marketsMap = new Map<string, MarketCapInfo>();
    existingCaps?.marketCaps.forEach((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      const market = availableMarkets.find((m) => m.uniqueKey.toLowerCase() === parsed.marketId?.toLowerCase());
      if (market) {
        marketsMap.set(market.uniqueKey, {
          market,
          relativeCap: (parseFloat(cap.relativeCap) / 1e16).toString(),
          absoluteCap: cap.absoluteCap === '0' ? '' : (Number(cap.absoluteCap) / 10 ** vaultAssetDecimals).toString(),
        });
      }
    });
    setSelectedMarkets(marketsMap);
  }, [availableMarkets, chainId, existingCaps, findToken, vaultAssetDecimals]);

  const handleToggleMarket = useCallback((marketId: string) => {
    const market = availableMarkets.find((m) => m.uniqueKey === marketId);
    if (!market) return;

    setSelectedMarkets((prev) => {
      const next = new Map(prev);
      if (next.has(marketId)) {
        // Removing market
        next.delete(marketId);
      } else {
        // Adding market
        next.set(marketId, {
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
              needsCreation: true,
            });
            return newCaps;
          }
          return prevCaps;
        });
      }
      return next;
    });

    // Clean up unused collateral caps
    setCollateralCaps((prevCaps) => {
      const usedCollaterals = new Set<string>();
      selectedMarkets.forEach((info) => {
        usedCollaterals.add(info.market.collateralAsset.address.toLowerCase());
      });

      // Add/remove the toggled market's collateral
      const toggledMarket = availableMarkets.find((m) => m.uniqueKey === marketId);
      if (toggledMarket) {
        const collateralAddr = toggledMarket.collateralAsset.address.toLowerCase();
        if (!selectedMarkets.has(marketId)) {
          usedCollaterals.add(collateralAddr);
        } else {
          usedCollaterals.delete(collateralAddr);
        }
      }

      const newCaps = new Map(prevCaps);
      for (const [addr, info] of newCaps.entries()) {
        if (info.needsCreation && !usedCollaterals.has(addr)) {
          newCaps.delete(addr);
        }
      }
      return newCaps;
    });
  }, [availableMarkets, selectedMarkets]);

  const handleUpdateMarketCap = useCallback((marketId: string, field: 'relativeCap' | 'absoluteCap', value: string) => {
    setSelectedMarkets((prev) => {
      const next = new Map(prev);
      const existing = next.get(marketId);
      if (existing) {
        next.set(marketId, { ...existing, [field]: value });
      }
      return next;
    });
  }, []);

  const handleUpdateCollateralCap = useCallback((collateralAddr: string, field: 'relativeCap' | 'absoluteCap', value: string) => {
    setCollateralCaps((prev) => {
      const next = new Map(prev);
      const existing = next.get(collateralAddr.toLowerCase());
      if (existing) {
        next.set(collateralAddr.toLowerCase(), { ...existing, [field]: value });
      }
      return next;
    });
  }, []);

  const hasChanges = useMemo(() => {
    const existingMarketIds = new Set(
      existingCaps?.marketCaps.map((cap) => {
        const parsed = parseCapIdParams(cap.idParams);
        return parsed.marketId?.toLowerCase();
      }) ?? []
    );
    const currentMarketIds = new Set(Array.from(selectedMarkets.keys()).map((id) => id.toLowerCase()));

    if (existingMarketIds.size !== currentMarketIds.size) return true;
    for (const id of currentMarketIds) {
      if (!existingMarketIds.has(id)) return true;
    }

    return Array.from(collateralCaps.values()).some((c) => c.needsCreation) || selectedMarkets.size > 0;
  }, [selectedMarkets, collateralCaps, existingCaps]);

  // Switch chain an submit tx
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

    // Add collateral caps
    for (const [, info] of collateralCaps.entries()) {
      const relativeCapBigInt = info.relativeCap && parseFloat(info.relativeCap) > 0
        ? parseUnits(info.relativeCap, 16)
        : 0n;

      const absoluteCapBigInt = info.absoluteCap && parseFloat(info.absoluteCap) > 0
        ? parseUnits(info.absoluteCap, vaultAssetDecimals)
        : MAX_UINT256;

      const { params, id } = getCollateralCapId(info.collateralAddress);

      console.log('collateral params, id', params, id)

      capsToUpdate.push({
        capId: id,
        idParams: params,
        relativeCap: relativeCapBigInt.toString(),
        absoluteCap: absoluteCapBigInt.toString(),
      });
    }

    // Add market caps
    for (const [, info] of selectedMarkets.entries()) {
      const relativeCapBigInt = info.relativeCap && parseFloat(info.relativeCap) > 0
        ? parseUnits(info.relativeCap, 16)
        : 0n;

      const absoluteCapBigInt = info.absoluteCap && parseFloat(info.absoluteCap) > 0
        ? parseUnits(info.absoluteCap, vaultAssetDecimals)
        : MAX_UINT256;

      const marketParams = {
        loanToken: info.market.loanAsset.address as Address,
        collateralToken: info.market.collateralAsset.address as Address,
        oracle: info.market.oracleAddress as Address,
        irm: info.market.irmAddress as Address,
        lltv: BigInt(info.market.lltv),
      };

      const { params, id } = getMarketCapId(adapterAddress, marketParams);

      console.log('collateral param, id', params, id)

      capsToUpdate.push({
        capId: id,
        idParams: params,
        relativeCap: relativeCapBigInt.toString(),
        absoluteCap: absoluteCapBigInt.toString(),
      });
    }

    if (capsToUpdate.length === 0) return;

    const success = await onSave(capsToUpdate);
    if (success) {
      // Parent handles switching back to read mode
    }
  }, [selectedMarkets, collateralCaps, needSwitchChain, switchToNetwork, onSave, adapterAddress, vaultAsset, vaultAssetDecimals]);

  if (marketsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  if (availableMarkets.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-secondary">
          No markets found for this vault's asset.
        </p>
        <Button variant="ghost" size="sm" onPress={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  const selectedCount = selectedMarkets.size;
  const collateralCount = collateralCaps.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Edit Allocation Caps</h3>
          <p className="text-xs text-secondary">Select markets and configure caps</p>
        </div>
      </div>

      {/* Collateral Caps Section */}
      {collateralCount > 0 && (
        <div className="space-y-3 rounded bg-hovered/20">
          <div className="flex items-center gap-1">
            <h4 className="text-sm text-secondary">Collateral Caps ({collateralCount})</h4>
            <CollateralCapTooltip />
          </div>
          <div className="space-y-2">
            {Array.from(collateralCaps.values()).map((info) => (
              <div key={info.collateralAddress} className="flex items-center gap-2 text-xs">
                <TokenIcon
                  address={info.collateralAddress}
                  chainId={chainId}
                  width={20}
                  height={20}
                />
                <span className="flex-1">{info.collateralSymbol}</span>
                {info.needsCreation && (
                  <Badge> New </Badge>
                )}
                <input
                  type="text"
                  value={info.relativeCap}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      const num = parseFloat(val);
                      if (val === '' || (num >= 0 && num <= 100)) {
                        handleUpdateCollateralCap(info.collateralAddress, 'relativeCap', val);
                      }
                    }
                  }}
                  placeholder="100"
                  disabled={!isOwner}
                  className="w-14 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-secondary">%</span>
                <input
                  type="text"
                  value={info.absoluteCap}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      handleUpdateCollateralCap(info.collateralAddress, 'absoluteCap', val);
                    }
                  }}
                  placeholder="No limit"
                  disabled={!isOwner}
                  className="w-20 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Markets Table with Inline Cap Inputs */}
      <div className="space-y-3">
        <h4 className="text-sm text-secondary">
          Markets {selectedCount > 0 ? `(${selectedCount} selected)` : ''}
        </h4>
        <MarketsTableWithSameLoanAsset
          markets={availableMarkets.map((m) => ({
            market: m,
            isSelected: selectedMarkets.has(m.uniqueKey),
          }))}
          onToggleMarket={handleToggleMarket}
          disabled={!isOwner}
          renderCartItemExtra={(market) => {
            const capInfo = selectedMarkets.get(market.uniqueKey);
            if (!capInfo) return null;

            return (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={capInfo.relativeCap}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        const num = parseFloat(val);
                        if (val === '' || (num >= 0 && num <= 100)) {
                          handleUpdateMarketCap(market.uniqueKey, 'relativeCap', val);
                        }
                      }
                    }}
                    placeholder="100"
                    disabled={!isOwner}
                    className="w-14 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-secondary">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={capInfo.absoluteCap}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        handleUpdateMarketCap(market.uniqueKey, 'absoluteCap', val);
                      }
                    }}
                    placeholder="No limit"
                    disabled={!isOwner}
                    className="w-20 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            );
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-divider/30 pt-4">
        <div></div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onPress={onCancel}>
            Cancel
          </Button>
          <Button
            variant="cta"
            size="sm"
            isDisabled={!hasChanges || isUpdating || selectedCount === 0}
            onPress={() => void handleSave()}
          >
            {isUpdating ? (
              <span className="flex items-center gap-2">
                <Spinner size={12} /> Saving...
              </span>
            ) : needSwitchChain ? (
              'Switch Network'
            ) : (
              `Save ${selectedCount + collateralCount} cap${selectedCount + collateralCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

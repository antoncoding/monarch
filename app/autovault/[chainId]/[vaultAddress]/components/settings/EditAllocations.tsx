import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address, parseUnits } from 'viem';
import { Button } from '@/components/common/Button';
import { MarketsTableWithSameLoanAsset } from '@/components/common/MarketsTableWithSameLoanAsset';
import { Spinner } from '@/components/common/Spinner';
import { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useMarkets } from '@/hooks/useMarkets';
import { getMarketCapId, parseCapIdParams } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { MarketCapState } from './types';
import { CapData } from '@/hooks/useVaultV2Data';

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

export function EditAllocations({
  existingCaps,
  vaultAsset,
  chainId,
  isOwner,
  isUpdating,
  adapterAddress,
  onCancel,
  onSave,
}: EditAllocationsProps) {
  const [marketCaps, setMarketCaps] = useState<MarketCapState[]>([]);
  const { markets, loading: marketsLoading } = useMarkets();
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({ targetChainId: chainId });

  // Initialize market caps from markets and existing data
  useEffect(() => {
    if (!markets || !vaultAsset) return;

    const filteredMarkets = markets.filter(
      (m) =>
        m.loanAsset.address.toLowerCase() === vaultAsset.toLowerCase() &&
        m.morphoBlue.chain.id === chainId,
    );

    setMarketCaps(
      filteredMarkets.map((market) => {
        const existingCap = existingCaps.find((c) => {
          const parsed = parseCapIdParams(c.idParams);
          return parsed.marketId?.toLowerCase() === market.uniqueKey.toLowerCase();
        });
        return {
          market,
          relativeCap: existingCap ? (parseFloat(existingCap.relativeCap) / 1e16).toString() : '',
          isSelected: !!existingCap,
        };
      }),
    );
  }, [markets, vaultAsset, chainId, existingCaps]);

  const handleToggleMarket = useCallback((marketId: string) => {
    setMarketCaps((prev) =>
      prev.map((c) => {
        if (c.market.uniqueKey === marketId) {
          const newIsSelected = !c.isSelected;
          return {
            ...c,
            isSelected: newIsSelected,
            relativeCap: newIsSelected && !c.relativeCap ? '100' : c.relativeCap,
          };
        }
        return c;
      }),
    );
  }, []);

  const handleUpdateCapField = useCallback((marketId: string, value: string) => {
    setMarketCaps((prev) =>
      prev.map((c) => (c.market.uniqueKey === marketId ? { ...c, relativeCap: value } : c)),
    );
  }, []);

  const hasChanges = useMemo(() => {
    return marketCaps.some((c) => {
      const existingCap = existingCaps.find((ec) => {
        const parsed = parseCapIdParams(ec.idParams);
        return parsed.marketId?.toLowerCase() === c.market.uniqueKey.toLowerCase();
      });
      if (c.isSelected !== !!existingCap) return true;
      if (c.isSelected) {
        const existingRelative = existingCap
          ? (parseFloat(existingCap.relativeCap) / 1e16).toString()
          : '';
        return c.relativeCap !== existingRelative;
      }
      return false;
    });
  }, [marketCaps, existingCaps]);

  const selectedCount = useMemo(() => {
    return marketCaps.filter((c) => c.isSelected).length;
  }, [marketCaps]);

  const handleSave = useCallback(async () => {
    if (needSwitchChain) {
      switchToNetwork();
      return;
    }

    if (!adapterAddress) {
      console.error('Adapter address is required to save caps');
      return;
    }

    const capsToUpdate = marketCaps
      .filter((c) => c.isSelected)
      .map((c) => {
        const relativeCapBigInt =
          c.relativeCap && parseFloat(c.relativeCap) > 0 ? parseUnits(c.relativeCap, 16) : 0n;

        // Create MarketParams from the market object
        const marketParams = {
          loanToken: c.market.loanAsset.address as Address,
          collateralToken: c.market.collateralAsset.address as Address,
          oracle: c.market.oracleAddress as Address,
          irm: c.market.irmAddress as Address,
          lltv: BigInt(c.market.lltv),
        };

        const { params, id } = getMarketCapId(adapterAddress, marketParams);

        return {
          capId: id,
          idParams: params,
          relativeCap: relativeCapBigInt.toString(),
          absoluteCap: '0',
        } as VaultV2Cap;
      });

    if (capsToUpdate.length === 0) return;

    const success = await onSave(capsToUpdate);
    if (success) {
      // Parent will handle switching back to read mode
    }
  }, [marketCaps, needSwitchChain, switchToNetwork, onSave]);

  if (marketsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  if (marketCaps.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-secondary">
          No markets found for this vault's asset. Caps can be configured once markets are
          available.
        </p>
        <Button variant="ghost" size="sm" onPress={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Edit Market Caps</h3>
          <p className="text-xs text-secondary">Select markets and set allocation caps</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded bg-hovered/30 p-3">
          <p className="text-xs text-secondary">
            💡 Set maximum allocation percentage for each market. Total can exceed 100% - agents
            will rebalance proportionally.
          </p>
        </div>

        <MarketsTableWithSameLoanAsset
          markets={marketCaps.map((c) => ({
            market: c.market,
            isSelected: c.isSelected,
          }))}
          onToggleMarket={handleToggleMarket}
          disabled={!isOwner}
          renderCartItemExtra={(market) => {
            const capState = marketCaps.find((c) => c.market.uniqueKey === market.uniqueKey);
            if (!capState) return null;

            return (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={capState.relativeCap || '100'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      const numValue = parseFloat(value);
                      if (value === '' || (numValue >= 0 && numValue <= 100)) {
                        handleUpdateCapField(market.uniqueKey, value);
                      }
                    }
                  }}
                  placeholder="100"
                  disabled={!isOwner}
                  className="w-16 rounded border border-divider/30 bg-surface px-2 py-1 text-right text-sm shadow-sm focus:border-primary focus:outline-none"
                />
                <span className="text-xs text-secondary">%</span>
              </div>
            );
          }}
        />

        <div className="flex items-center justify-between border-t border-divider/30 pt-4">
          <div className="text-sm text-secondary">
            {selectedCount} market{selectedCount !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onPress={onCancel}>
              Cancel
            </Button>
            <Button
              variant="interactive"
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
                `Save ${selectedCount} cap${selectedCount !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

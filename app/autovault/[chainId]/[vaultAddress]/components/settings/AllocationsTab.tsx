import { useCallback, useEffect, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/common/Button';
import { MarketsTableWithSameLoanAsset } from '@/components/common/MarketsTableWithSameLoanAsset';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { VaultV2Cap } from '@/data-sources/subgraph/v2-vaults';
import { useMarkets } from '@/hooks/useMarkets';
import { AllocationsTabProps, MarketCapState } from './types';

export function AllocationsTab({
  isOwner,
  chainId,
  vaultAsset,
  existingCaps,
  onUpdateCaps,
  isUpdatingCaps,
}: AllocationsTabProps) {
  const [marketCaps, setMarketCaps] = useState<MarketCapState[]>([]);
  const [isEditingCaps, setIsEditingCaps] = useState(false);
  const { markets, loading: marketsLoading } = useMarkets();

  // Initialize market caps from existing data
  useEffect(() => {
    if (!markets || !vaultAsset) return;

    // Don't re-initialize while editing
    if (isEditingCaps) return;

    const filteredMarkets = markets.filter(
      (m) =>
        m.loanAsset.address.toLowerCase() === vaultAsset.toLowerCase() &&
        m.morphoBlue.chain.id === chainId,
    );

    setMarketCaps(
      filteredMarkets.map((market) => {
        const existingCap = existingCaps.find((c) => c.marketId === market.uniqueKey);
        return {
          market,
          relativeCap: existingCap
            ? (parseFloat(existingCap.relativeCap) / 1e16).toString()
            : '',
          isSelected: !!existingCap,
        };
      }),
    );
  }, [markets, vaultAsset, chainId, isEditingCaps, existingCaps]);

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

  const handleSaveCaps = useCallback(async () => {
    const capsToUpdate = marketCaps
      .filter((c) => c.isSelected)
      .map((c) => {
        const relativeCapBigInt =
          c.relativeCap && parseFloat(c.relativeCap) > 0
            ? parseUnits(c.relativeCap, 16)
            : 0n;

        return {
          marketId: c.market.uniqueKey,
          relativeCap: relativeCapBigInt.toString(),
          absoluteCap: '0',
        } as VaultV2Cap;
      });

    if (capsToUpdate.length === 0) return;

    const success = await onUpdateCaps(capsToUpdate);
    if (success) {
      setIsEditingCaps(false);
    }
  }, [marketCaps, onUpdateCaps]);

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
      </div>
    );
  }

  const currentCaps = existingCaps;
  const hasAnyCaps = currentCaps.length > 0;

  const hasChanges = marketCaps.some((c) => {
    const existingCap = existingCaps.find((ec) => ec.marketId === c.market.uniqueKey);
    if (c.isSelected !== !!existingCap) return true;
    if (c.isSelected) {
      const existingRelative = existingCap
        ? (parseFloat(existingCap.relativeCap) / 1e16).toString()
        : '';
      return c.relativeCap !== existingRelative;
    }
    return false;
  });

  const selectedCount = marketCaps.filter((c) => c.isSelected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Market Caps</h3>
          <p className="text-xs text-secondary">
            Maximum allocation per market
          </p>
        </div>
        {!isEditingCaps && (
          <Button
            variant="interactive"
            size="sm"
            onPress={() => setIsEditingCaps(true)}
            isDisabled={!isOwner}
          >
            {hasAnyCaps ? 'Edit' : 'Add markets'}
          </Button>
        )}
      </div>

      {!isEditingCaps ? (
        // Read-only view - Current caps
        !hasAnyCaps ? (
          <p className="text-sm text-secondary">No market caps configured</p>
        ) : (
          <div className="space-y-2">
            {currentCaps.map((cap) => {
              const market = marketCaps.find((m) => m.market.uniqueKey === cap.marketId)?.market;
              if (!market) return null;

              const relativeCapPercent = (parseFloat(cap.relativeCap) / 1e16).toFixed(2);

              return (
                <div
                  key={cap.marketId}
                  className="flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <div className="z-10">
                        <TokenIcon
                          address={market.loanAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.loanAsset.symbol}
                          width={20}
                          height={20}
                        />
                      </div>
                      <div className="bg-surface -ml-2.5">
                        <TokenIcon
                          address={market.collateralAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.collateralAsset.symbol}
                          width={20}
                          height={20}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {market.loanAsset.symbol} / {market.collateralAsset.symbol}
                        </span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {formatUnits(BigInt(market.lltv), 16)}% LTV
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{relativeCapPercent}%</p>
                    <p className="text-xs text-secondary">max</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // Edit mode - Market selection
        <div className="space-y-3">
          <p className="text-xs text-secondary">
            Select markets and set caps. Total can exceed 100%.
          </p>

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
                    className="w-16 rounded border border-gray-200 bg-background px-2 py-1 text-right text-sm focus:border-primary focus:outline-none dark:border-gray-700"
                  />
                  <span className="text-xs text-secondary">% max</span>
                </div>
              );
            }}
          />

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-secondary">
              {selectedCount} market{selectedCount !== 1 ? 's' : ''} selected
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setIsEditingCaps(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="interactive"
                size="sm"
                isDisabled={!hasChanges || isUpdatingCaps || selectedCount === 0}
                onPress={() => void handleSaveCaps()}
              >
                {isUpdatingCaps ? (
                  <span className="flex items-center gap-2">
                    <Spinner size={12} /> Saving...
                  </span>
                ) : (
                  `Save ${selectedCount} market${selectedCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';
import { Spinner } from '@/components/common/Spinner';
import { useMarkets } from '@/hooks/useMarkets';
import { parseCapIdParams } from '@/utils/morpho';
import { CapData } from '@/hooks/useVaultV2Data';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { Address } from 'viem';
import { findToken } from '@/utils/tokens';

type CurrentAllocationsProps = {
  existingCaps?: CapData;
  isOwner: boolean;
  onStartEdit: () => void;
  vaultAsset?: Address;
  chainId: number
};

export function CurrentAllocations({
  existingCaps,
  isOwner,
  onStartEdit,
  chainId,
  vaultAsset
}: CurrentAllocationsProps) {
  const { markets, loading: marketsLoading } = useMarkets();
  const [expandedCollaterals, setExpandedCollaterals] = useState<Set<string>>(new Set());

  const token = vaultAsset ? findToken(vaultAsset, chainId) : undefined

  const hasAnyCaps = existingCaps && (
    existingCaps.adapterCap !== null ||
    existingCaps.collateralCaps.length > 0 ||
    existingCaps.marketCaps.length > 0
  );

  // Group market caps by collateral
  const marketCapsByCollateral = useMemo(() => {
    const grouped = new Map<string, Array<{
      cap: NonNullable<typeof existingCaps>['marketCaps'][0];
      market: typeof markets[0] | null;
      capPercent: string;
    }>>();

    if (!existingCaps) return grouped;

    existingCaps.marketCaps.forEach((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      if (parsed.type === 'market' && parsed.marketParams) {
        const collateralAddr = parsed.marketParams.collateralToken.toLowerCase();

        const market = markets.find(
          (m) => m.uniqueKey.toLowerCase() === (parsed.marketId ?? '').toLowerCase()
        ) ?? null;

        if (!grouped.has(collateralAddr)) {
          grouped.set(collateralAddr, []);
        }

        grouped.get(collateralAddr)!.push({
          cap,
          market,
          capPercent: (parseFloat(cap.relativeCap) / 1e16).toFixed(2),
        });
      }
    });

    return grouped;
  }, [existingCaps, markets]);

  // Map collateral caps with their markets
  const collateralCapsWithMarkets = useMemo(() => {
    return existingCaps?.collateralCaps.map((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      const collateralAddr = parsed.collateralToken?.toLowerCase() ?? '';
      const marketsForCollateral = marketCapsByCollateral.get(collateralAddr) || [];

      // Get collateral symbol from first market
      const collateralSymbol = marketsForCollateral[0]?.market?.collateralAsset.symbol || 'Unknown';

      return {
        cap,
        collateralToken: parsed.collateralToken ?? 'Unknown',
        collateralSymbol,
        capPercent: (parseFloat(cap.relativeCap) / 1e16).toFixed(2),
        markets: marketsForCollateral,
      };
    }) || [];
  }, [existingCaps, marketCapsByCollateral]);

  const toggleCollateral = (collateralAddr: string) => {
    setExpandedCollaterals((prev) => {
      const next = new Set(prev);
      if (next.has(collateralAddr)) {
        next.delete(collateralAddr);
      } else {
        next.add(collateralAddr);
      }
      return next;
    });
  };

  if (marketsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Allocation Caps</h3>
          <p className="text-xs text-secondary">
            Set limits on how much of each asset can be allocated across markets and collaterals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button variant="subtle" size="sm" onPress={onStartEdit}>
              {hasAnyCaps ? 'Edit caps' : 'Add caps'}
            </Button>
          )}
        </div>
      </div>

      {!hasAnyCaps ? (
        <div className="rounded border border-dashed border-divider/50 bg-hovered/30 p-6 text-center">
          <p className="text-sm text-secondary">No caps configured yet</p>
          <p className="mt-1 text-xs text-secondary">
            Set caps to control how agents allocate funds across markets
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Adapter Cap (Level 1) */}
          {existingCaps?.adapterCap && (
            <div className="rounded border-2 border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-primary">Adapter Cap</h4>
                    <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                      Level 1
                    </span>
                  </div>
                  <p className="text-xs text-secondary">Total allocation limit for this adapter</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {(parseFloat(existingCaps.adapterCap.relativeCap) / 1e16).toFixed(2)}%
                  </div>
                  <div className="text-xs text-secondary">Relative cap</div>
                </div>
              </div>
            </div>
          )}

          {/* Collateral Caps (Level 2) */}
          {collateralCapsWithMarkets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-secondary">Collateral Caps</h4>
                <span className="rounded bg-hovered px-2 py-0.5 text-xs font-medium text-secondary">
                  Level 2
                </span>
                <span className="text-xs text-secondary">
                  ({collateralCapsWithMarkets.length})
                </span>
              </div>

              <div className="space-y-2">
                {collateralCapsWithMarkets.map((item) => {
                  const collateralAddr = item.collateralToken.toLowerCase();
                  const isExpanded = expandedCollaterals.has(collateralAddr);
                  const hasMarkets = item.markets.length > 0;

                  return (
                    <div
                      key={item.cap.capId}
                      className="rounded border border-divider/40 bg-surface overflow-hidden"
                    >
                      {/* Collateral Cap Header */}
                      <div
                        className={`p-4 ${hasMarkets ? 'cursor-pointer hover:bg-hovered/30' : ''}`}
                        onClick={() => hasMarkets && toggleCollateral(collateralAddr)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{item.collateralSymbol}</p>
                                {hasMarkets && (
                                  <span className="text-xs text-secondary">
                                    ({item.markets.length} market{item.markets.length !== 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                              <p className="font-mono text-xs text-secondary mt-1">
                                {item.collateralToken}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-primary">
                                {item.capPercent}%
                              </div>
                              <div className="text-xs text-secondary">Collateral cap</div>
                            </div>
                            {hasMarkets && (
                              <div className="text-secondary">
                                {isExpanded ? (
                                  <ChevronUpIcon className="h-4 w-4" />
                                ) : (
                                  <ChevronDownIcon className="h-4 w-4" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Market Caps (Level 3) - Expandable */}
                      {isExpanded && hasMarkets && (
                        <div className="border-t border-divider/30 bg-hovered/10 p-3">
                          <div className="flex items-center gap-2 mb-3 px-1">
                            <h5 className="text-xs font-medium text-secondary">Market Caps</h5>
                            <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">
                              Level 3
                            </span>
                          </div>
                          <div className="space-y-3">
                            {item.markets.map((marketItem) => {
                              if (!marketItem.market) {
                                return (
                                  <div
                                    key={marketItem.cap.capId}
                                    className="rounded bg-surface p-3 text-xs text-secondary"
                                  >
                                    Market data not available
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={marketItem.cap.capId}
                                  className="rounded bg-surface border border-divider/20 overflow-hidden"
                                >
                                  <MarketDetailsBlock
                                    market={marketItem.market}
                                    showDetailsLink={false}
                                    defaultCollapsed
                                    mode="supply"
                                    showRewards={false}
                                  />
                                  <div className="flex items-center justify-between bg-primary/5 px-3 py-2 border-t border-divider/20">
                                    <span className="text-xs text-secondary">Market allocation cap</span>
                                    <div className="text-right">
                                      <span className="text-sm font-semibold text-primary">
                                        {marketItem.capPercent}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Orphaned Market Caps (markets without collateral caps) */}
          {existingCaps?.marketCaps.length > 0 && (
            (() => {
              const collateralsWithCaps = new Set(
                collateralCapsWithMarkets.map((c) => c.collateralToken.toLowerCase())
              );

              const orphanedMarkets = existingCaps.marketCaps.filter((cap) => {
                const parsed = parseCapIdParams(cap.idParams);
                if (parsed.type === 'market' && parsed.marketParams) {
                  const collateralAddr = parsed.marketParams.collateralToken.toLowerCase();
                  return !collateralsWithCaps.has(collateralAddr);
                }
                return false;
              });

              if (orphanedMarkets.length === 0) return null;

              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-secondary">Direct Market Caps</h4>
                    <span className="text-xs text-secondary">
                      (without collateral caps)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {orphanedMarkets.map((cap) => {
                      const parsed = parseCapIdParams(cap.idParams);
                      const market = markets.find(
                        (m) => m.uniqueKey.toLowerCase() === (parsed.marketId ?? '').toLowerCase()
                      );

                      if (!market) return null;

                      return (
                        <div
                          key={cap.capId}
                          className="rounded border border-divider/40 bg-surface overflow-hidden"
                        >
                          <MarketDetailsBlock
                            market={market}
                            showDetailsLink={false}
                            defaultCollapsed
                            mode="supply"
                            showRewards={false}
                          />
                          <div className="flex items-center justify-between bg-primary/5 px-3 py-2 border-t border-divider/20">
                            <span className="text-xs text-secondary">Market cap</span>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-primary">
                                {(parseFloat(cap.relativeCap) / 1e16).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

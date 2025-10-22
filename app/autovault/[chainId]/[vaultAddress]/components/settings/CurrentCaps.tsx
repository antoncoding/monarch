import { useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarkets } from '@/hooks/useMarkets';
import { parseCapIdParams } from '@/utils/morpho';
import { CapData } from '@/hooks/useVaultV2Data';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { Address, maxUint128 } from 'viem';
import { findToken } from '@/utils/tokens';
import { MarketCapsTable } from './MarketCapsTable';
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';
import { CollateralCapTooltip } from './Tooltips';

type CurrentCapsProps = {
  existingCaps?: CapData;
  isOwner: boolean;
  onStartEdit: () => void;
  vaultAsset?: Address;
  chainId: number
};

export function CurrentCaps({
  existingCaps,
  isOwner,
  onStartEdit,
  chainId,
  vaultAsset
}: CurrentCapsProps) {
  const { markets, loading: marketsLoading } = useMarkets();
  const [expandedCollaterals, setExpandedCollaterals] = useState<Set<string>>(new Set());

  const vaultAssetToken = vaultAsset ? findToken(vaultAsset, chainId) : undefined;
  const vaultAssetDecimals = vaultAssetToken?.decimals ?? 18;

  // Format absolute cap value
  const formatAbsoluteCap = (cap: string): string => {
    if (!cap || cap === '') {
      return 'No limit';
    }

    try {
      const capBigInt = BigInt(cap);
      if (capBigInt >= maxUint128) {
        return 'No limit';
      }
      const value = Number(capBigInt) / 10 ** vaultAssetDecimals;
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } catch (e) {
      // If we can't parse it as BigInt, return as is
      return cap;
    }
  };

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

      if (parsed.type === 'market' && parsed.marketParams?.collateralToken) {
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

      // Get collateral symbol - try from token lookup first, then from market
      const collateralToken = findToken(parsed.collateralToken as Address, chainId);
      const collateralSymbol = collateralToken?.symbol ||
                              marketsForCollateral[0]?.market?.collateralAsset.symbol ||
                              'Unknown';

      return {
        cap,
        collateralToken: parsed.collateralToken ?? 'Unknown',
        collateralSymbol,
        capPercent: (parseFloat(cap.relativeCap) / 1e16).toFixed(2),
        markets: marketsForCollateral,
      };
    }) || [];
  }, [existingCaps, marketCapsByCollateral, chainId]);

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
          <h3 className="text-base font-medium">Cap Settings</h3>
          <p className="text-xs text-secondary">
            Define allocation limits across markets and collaterals to control agent behavior.
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
        <div className="rounded bg-hovered/30 p-6 text-center">
          <p className="text-sm text-secondary">No caps configured yet</p>
          <p className="mt-1 text-xs text-secondary">
            Set caps to control how agents allocate funds across markets
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Collateral Caps */}
          {collateralCapsWithMarkets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <h4 className="text-sm text-secondary">Collateral Caps ({collateralCapsWithMarkets.length})</h4>
                <CollateralCapTooltip />
              </div>

              {/* Column Headers */}
              <div className="flex items-center gap-2 pb-2 text-xs font-medium text-secondary">
                <div className="flex-1">Collateral</div>
                <div className="w-20 text-right">Relative %</div>
                <div className="w-24 text-right">Absolute {vaultAssetToken?.symbol ? `(${vaultAssetToken.symbol})` : ''}</div>
              </div>

              <div className="space-y-2">
                {collateralCapsWithMarkets.map((item) => {
                  const collateralAddr = item.collateralToken.toLowerCase();
                  const isExpanded = expandedCollaterals.has(collateralAddr);
                  const hasMarkets = item.markets.length > 0;

                  return (
                    <div
                      key={item.cap.capId}
                      className="rounded bg-surface overflow-hidden"
                    >
                      {/* Collateral Cap Row */}
                      <div
                        className={`flex items-center gap-2 p-2 text-xs ${hasMarkets ? 'cursor-pointer hover:bg-hovered/30' : ''}`}
                        onClick={() => hasMarkets && toggleCollateral(collateralAddr)}
                      >
                        <TokenIcon
                          address={item.collateralToken as Address}
                          chainId={chainId}
                          width={20}
                          height={20}
                        />
                        <div className="flex-1 flex items-center gap-2">
                          <span className="font-medium">{item.collateralSymbol}</span>
                          {hasMarkets && (
                            <span className="text-secondary">
                              ({item.markets.length} market{item.markets.length !== 1 ? 's' : ''})
                            </span>
                          )}
                        </div>
                        <div className="w-20 text-right font-semibold text-primary">
                          {item.capPercent}%
                        </div>
                        <div className="w-24 text-right text-secondary">
                          {formatAbsoluteCap(item.cap.absoluteCap)}
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

                      {/* Market Caps - Expandable */}
                      {isExpanded && hasMarkets && (
                        <div className="bg-hovered/10 p-3">
                          <h5 className="text-xs font-medium text-secondary mb-3 px-1">Market Caps</h5>
                          <MarketCapsTable
                            markets={item.markets
                              .filter(m => m.market)
                              .map(m => ({
                                market: m.market!,
                                relativeCap: m.capPercent,
                                absoluteCap: m.cap.absoluteCap,
                                isEditable: false,
                              }))}
                            showHeaders={false}
                            vaultAssetSymbol={vaultAssetToken?.symbol}
                            vaultAssetAddress={vaultAsset}
                            chainId={chainId}
                          />
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
                if (parsed.type === 'market' && parsed.marketParams?.collateralToken) {
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
                          className="rounded bg-surface overflow-hidden"
                        >
                          <div className="p-3">
                            <MarketDetailsBlock
                              market={market}
                              disableExpansion
                            />
                          </div>
                          <div className="flex items-center gap-2 bg-hovered/10 px-3 py-2 border-t border-divider/20 text-xs">
                            <span className="flex-1 text-secondary">Caps:</span>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="font-semibold text-primary">
                                  {(parseFloat(cap.relativeCap) / 1e16).toFixed(2)}%
                                </span>
                                <span className="text-secondary ml-1">relative</span>
                              </div>
                              <div className="text-right text-secondary">
                                {formatAbsoluteCap(cap.absoluteCap)}
                                <span className="ml-1">absolute</span>
                              </div>
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

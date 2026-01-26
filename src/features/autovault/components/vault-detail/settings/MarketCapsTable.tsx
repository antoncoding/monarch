import { Cross2Icon, InfoCircledIcon } from '@radix-ui/react-icons';
import { type Address, maxUint128 } from 'viem';
import { Badge } from '@/components/ui/badge';
import { MarketIdentity, MarketIdentityFocus } from '@/features/markets/components/market-identity';
import { findToken } from '@/utils/tokens';
import type { Market } from '@/utils/types';

type MarketCapRow = {
  market: Market;
  relativeCap: string;
  absoluteCap: string;
  isEditable?: boolean;
  isNew?: boolean;
  isRemoved?: boolean;
  collateralCapPercent?: number;
  onUpdateCap?: (field: 'relativeCap' | 'absoluteCap', value: string) => void;
  onRemove?: () => void;
  onUndoRemove?: () => void;
};

type MarketCapsTableProps = {
  markets: MarketCapRow[];
  showHeaders?: boolean;
  vaultAssetSymbol?: string;
  vaultAssetAddress?: Address;
  chainId?: number;
  isOwner?: boolean;
};

export function MarketCapsTable({
  markets,
  showHeaders = true,
  vaultAssetSymbol,
  vaultAssetAddress,
  chainId,
  isOwner = true,
}: MarketCapsTableProps) {
  const vaultAssetDecimals = vaultAssetAddress && chainId ? (findToken(vaultAssetAddress, chainId)?.decimals ?? 18) : 18;

  const formatAbsoluteCap = (cap: string): string => {
    if (!cap) return 'No limit';

    try {
      const capBigInt = BigInt(cap);
      if (capBigInt >= maxUint128) return 'No limit';
      const value = Number(capBigInt) / 10 ** vaultAssetDecimals;
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } catch {
      return cap;
    }
  };

  if (markets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {showHeaders && (
        <div className="flex items-center gap-2 px-4 pb-2 text-xs font-medium text-secondary">
          <div className="flex-1">Market</div>
          <div className="w-20 text-right">Relative %</div>
          <div className="w-24 text-right">Absolute{vaultAssetSymbol ? ` (${vaultAssetSymbol})` : ''}</div>
        </div>
      )}
      <div className="space-y-1">
        {markets.map((row) => {
          const marketCapNum = Number.parseFloat(row.relativeCap) || 0;
          const isCollateralConstraining =
            row.collateralCapPercent !== undefined && row.collateralCapPercent < marketCapNum && !row.isRemoved;

          return (
            <div
              key={row.market.uniqueKey}
              className={`rounded bg-surface py-1 px-2 ${row.isRemoved ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <MarketIdentity
                    market={row.market}
                    chainId={chainId ?? row.market.morphoBlue.chain.id}
                    focus={MarketIdentityFocus.Collateral}
                    showLltv
                    showOracle
                    iconSize={20}
                    showExplorerLink
                  />
                  {row.isNew && !row.isRemoved && <Badge variant="primary">New</Badge>}
                </div>
                {(() => {
                  if (row.isRemoved) {
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary">Removed</span>
                        {row.onUndoRemove && (
                          <button
                            type="button"
                            onClick={row.onUndoRemove}
                            className="px-1.5 py-0.5 text-xs rounded-sm bg-primary/10 text-primary hover:bg-primary/20"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (row.isEditable && row.onUpdateCap) {
                    return (
                      <>
                        <div className="flex items-center gap-1 w-32">
                          <input
                            type="text"
                            value={row.relativeCap}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                const num = Number.parseFloat(val);
                                if (val === '' || (num >= 0 && num <= 100)) {
                                  row.onUpdateCap!('relativeCap', val);
                                }
                              }
                            }}
                            placeholder="100"
                            disabled={!isOwner}
                            className="w-16 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                          />
                          <span className="text-xs text-secondary">%</span>
                          <button
                            type="button"
                            onClick={() => row.onUpdateCap!('relativeCap', '100')}
                            disabled={!isOwner}
                            className="px-1.5 py-0.5 text-xs rounded-sm bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Max
                          </button>
                        </div>
                        <div className="flex items-center gap-1 w-36">
                          <input
                            type="text"
                            value={row.absoluteCap === maxUint128.toString() ? '' : row.absoluteCap}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                row.onUpdateCap!('absoluteCap', val);
                              }
                            }}
                            placeholder="No limit"
                            disabled={!isOwner}
                            className="w-24 rounded bg-hovered px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => row.onUpdateCap!('absoluteCap', '')}
                            disabled={!isOwner}
                            className="px-1.5 py-0.5 text-xs rounded-sm bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Max
                          </button>
                        </div>
                        {row.onRemove && isOwner && (
                          <button
                            type="button"
                            onClick={row.onRemove}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500"
                            aria-label="Remove market cap"
                          >
                            <Cross2Icon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    );
                  }

                  return (
                    <>
                      <div className="w-20 text-right text-sm">{row.relativeCap}%</div>
                      <div className="w-24 text-right text-sm text-secondary">{formatAbsoluteCap(row.absoluteCap)}</div>
                    </>
                  );
                })()}
              </div>
              {isCollateralConstraining && (
                <div className="mt-1 ml-7 flex items-center gap-1.5 text-xs text-secondary">
                  <InfoCircledIcon className="h-3 w-3 shrink-0" />
                  <span>
                    Effective cap limited to <span className="text-primary">{row.collateralCapPercent?.toFixed(2)}%</span> by existing
                    collateral cap
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

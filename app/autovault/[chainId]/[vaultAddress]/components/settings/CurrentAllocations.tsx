import { useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';
import { Spinner } from '@/components/common/Spinner';
import { VaultV2Cap } from '@/data-sources/subgraph/v2-vaults';
import { useMarkets } from '@/hooks/useMarkets';
import { parseCapId } from '@/utils/morpho';

type CurrentAllocationsProps = {
  existingCaps: VaultV2Cap[];
  isOwner: boolean;
  onStartEdit: () => void;
};

export function CurrentAllocations({
  existingCaps,
  isOwner,
  onStartEdit,
}: CurrentAllocationsProps) {
  const { markets, loading: marketsLoading } = useMarkets();
  const [showDetailed, setShowDetailed] = useState(false);

  // Separate caps by level
  const { adapterCap, collateralCaps, marketCaps } = useMemo(() => {
    let adapterCap: VaultV2Cap | null = null;
    const collateralCaps: VaultV2Cap[] = [];
    const marketCaps: VaultV2Cap[] = [];

    existingCaps.forEach((cap) => {
      const parsed = parseCapId(cap.capId);
      if (parsed.type === 'adapter') {
        adapterCap = cap;
      } else if (parsed.type === 'collateral') {
        collateralCaps.push(cap);
      } else if (parsed.type === 'market') {
        marketCaps.push(cap);
      }
    });

    return { adapterCap, collateralCaps, marketCaps };
  }, [existingCaps]);

  const hasAnyCaps = existingCaps.length > 0;

  console.log('existingCaps', existingCaps);

  // Map collateral caps to display data
  const collateralCapsWithData = useMemo(() => {
    return collateralCaps.map((cap) => {
      const parsed = parseCapId(cap.capId);
      return {
        cap,
        collateralToken: parsed.collateralToken ?? 'Unknown',
        capPercent: (parseFloat(cap.relativeCap) / 1e16).toFixed(2),
        absoluteCapFormatted: cap.absoluteCap,
      };
    });
  }, [collateralCaps]);

  // Map market caps to their market data (for detailed view)
  const marketsWithCaps = useMemo(() => {
    return marketCaps
      .map((cap) => {
        const parsed = parseCapId(cap.capId);
        // Use case-insensitive matching for marketId
        const market = markets.find(
          (m) => m.uniqueKey.toLowerCase() === (parsed.marketId ?? '').toLowerCase()
        );
        if (!market) return null;
        return {
          market,
          cap,
          capPercent: (parseFloat(cap.relativeCap) / 1e16).toFixed(2),
          absoluteCapFormatted: cap.absoluteCap,
        };
      })
      .filter((item) => item !== null);
  }, [marketCaps, markets]);

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
            Maximum allocation limits for adapter, collateral, and markets
          </p>
        </div>
        <div className="flex items-center gap-2">
          {collateralCaps.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setShowDetailed(!showDetailed)}
            >
              {showDetailed ? 'Show collateral view' : 'Show detailed markets'}
            </Button>
          )}
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
        <div className="space-y-6">
          {/* Adapter Cap (if exists) */}
          {adapterCap && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-secondary">Adapter Cap</h4>
              <div className="rounded border border-divider/40 bg-hovered/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-secondary">Total adapter allocation limit</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-primary">
                      {(parseFloat((adapterCap as VaultV2Cap).relativeCap) / 1e16).toFixed(2)}%
                    </div>
                    <div className="text-xs text-secondary">Relative cap</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collateral Caps or Market Caps based on toggle */}
          {!showDetailed ? (
            // Collateral-level caps (default view)
            collateralCaps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-secondary">
                  Collateral Caps ({collateralCaps.length})
                </h4>
                <div className="space-y-3">
                  {collateralCapsWithData.map((item, index) => (
                    <div
                      key={item.cap.capId}
                      className="rounded border border-divider/40 bg-hovered/20 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Collateral {index + 1}
                          </p>
                          <p className="font-mono text-xs text-secondary">
                            {item.collateralToken}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-primary">
                            {item.capPercent}%
                          </div>
                          <div className="text-xs text-secondary">
                            Abs: {item.absoluteCapFormatted}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            // Market-level caps (detailed view)
            marketCaps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-secondary">
                  Market Caps ({marketCaps.length})
                </h4>
                <div className="space-y-3">
                  {marketsWithCaps.map((item) => {
                    if (!item) return null;
                    const { market, capPercent, absoluteCapFormatted } = item;

                    return (
                      <div key={market.uniqueKey} className="space-y-2">
                        <MarketDetailsBlock
                          market={market}
                          showDetailsLink={false}
                          defaultCollapsed
                          mode="supply"
                          showRewards={false}
                        />
                        <div className="flex items-center justify-between rounded bg-primary/5 px-3 py-2">
                          <span className="text-xs text-secondary">Maximum allocation cap</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-primary">{capPercent}%</span>
                            <div className="text-xs text-secondary">Abs: {absoluteCapFormatted}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

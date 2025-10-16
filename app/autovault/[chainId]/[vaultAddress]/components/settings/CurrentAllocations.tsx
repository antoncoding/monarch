import { useMemo } from 'react';
import { Button } from '@/components/common/Button';
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';
import { Spinner } from '@/components/common/Spinner';
import { VaultV2Cap } from '@/data-sources/subgraph/v2-vaults';
import { useMarkets } from '@/hooks/useMarkets';

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
  const hasAnyCaps = existingCaps.length > 0;

  // Map existing caps to their market data
  const marketsWithCaps = useMemo(() => {
    return existingCaps
      .map((cap) => {
        // Use case-insensitive matching for marketId
        const market = markets.find(
          (m) => m.uniqueKey.toLowerCase() === cap.marketId.toLowerCase()
        );
        if (!market) return null;
        return {
          market,
          capPercent: (parseFloat(cap.relativeCap) / 1e16).toFixed(2),
        };
      })
      .filter((item) => item !== null);
  }, [existingCaps, markets]);

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
          <h3 className="text-base font-medium">Market Allocation Caps</h3>
          <p className="text-xs text-secondary">Maximum allocation percentage per market</p>
        </div>
        {isOwner && (
          <Button variant="subtle" size="sm" onPress={onStartEdit}>
            {hasAnyCaps ? 'Edit caps' : 'Add caps'}
          </Button>
        )}
      </div>

      {!hasAnyCaps ? (
        <div className="rounded border border-dashed border-divider/50 bg-hovered/30 p-6 text-center">
          <p className="text-sm text-secondary">No market caps configured yet</p>
          <p className="mt-1 text-xs text-secondary">
            Set caps to control how agents allocate funds across markets
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {marketsWithCaps.map((item) => {
            if (!item) return null;
            const { market, capPercent } = item;

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
                  <span className="text-sm font-semibold text-primary">{capPercent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

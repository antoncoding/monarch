import React from 'react';
import { LuX } from 'react-icons/lu';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/components/MarketIdentity';
import { Market } from '@/utils/types';
import { MarketWithSelection } from './MarketTableRow';

type MarketTableCartProps = {
  selectedMarkets: MarketWithSelection[];
  onToggleMarket: (marketId: string) => void;
  disabled: boolean;
  renderCartItemExtra?: (market: Market) => React.ReactNode;
}

export const MarketTableCart = React.memo(({
  selectedMarkets,
  onToggleMarket,
  disabled,
  renderCartItemExtra,
}: MarketTableCartProps) => {
  if (selectedMarkets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {selectedMarkets.map(({ market }) => (
        <div key={market.uniqueKey} className="rounded bg-hovered transition-colors">
          <div className="flex items-center justify-between p-2">
            <MarketIdentity
              market={market}
              chainId={market.morphoBlue.chain.id}
              mode={MarketIdentityMode.Focused}
              focus={MarketIdentityFocus.Collateral}
              showLltv
              showOracle
              iconSize={20}
              showExplorerLink={false}
            />

            <div className="flex items-center gap-2">
              {renderCartItemExtra && renderCartItemExtra(market)}
              <button
                type="button"
                onClick={() => onToggleMarket(market.uniqueKey)}
                disabled={disabled}
                className="flex h-6 w-6 items-center justify-center rounded-full text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

MarketTableCart.displayName = 'MarketTableCart';

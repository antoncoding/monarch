import React, { useMemo } from 'react';
import { Checkbox } from '@heroui/react';
import { MarketIdBadge } from '@/components/MarketIdBadge';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/components/MarketIdentity';
import { MarketIndicators } from '@/components/MarketIndicators';
import { TrustedByCell } from '@/components/vaults/TrustedVaultBadges';
import { type TrustedVault } from '@/constants/vaults/known_vaults';
import { formatAmountDisplay, getTrustedVaultsForMarket } from '@/utils/marketTableHelpers';
import { Market } from '@/utils/types';
import { ColumnVisibility } from 'app/markets/components/columnVisibility';

export type MarketWithSelection = {
  market: Market;
  isSelected: boolean;
};

type MarketTableRowProps = {
  marketWithSelection: MarketWithSelection;
  onToggle: () => void;
  disabled: boolean;
  showSelectColumn: boolean;
  columnVisibility: ColumnVisibility;
  trustedVaultMap: Map<string, TrustedVault>;
}

export const MarketTableRow = React.memo(({
  marketWithSelection,
  onToggle,
  disabled,
  showSelectColumn,
  columnVisibility,
  trustedVaultMap,
}: MarketTableRowProps) => {
  const { market, isSelected } = marketWithSelection;

  const trustedVaults = useMemo(() => {
    if (!columnVisibility.trustedBy) {
      return [];
    }
    return getTrustedVaultsForMarket(market, trustedVaultMap);
  }, [columnVisibility.trustedBy, market, trustedVaultMap]);

  return (
    <tr
      className={`cursor-pointer transition-colors hover:bg-surface-dark ${
        isSelected ? 'bg-primary/5' : ''
      }`}
      onClick={(e) => {
        // Don't toggle if clicking on input
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          onToggle();
        }
      }}
    >
      {showSelectColumn && (
        <td className="z-50 py-1">
          <div className="flex items-center justify-center gap-2">
            <Checkbox
              isSelected={isSelected}
              onValueChange={onToggle}
              isDisabled={disabled}
              className="h-6 w-4 cursor-pointer rounded border-gray-300 text-primary"
              onSelect={(e) => e.stopPropagation()}
              size="sm"
            />
          </div>
        </td>
      )}
      <td className="z-50 py-1 text-center" style={{ minWidth: '80px' }}>
        <MarketIdBadge marketId={market.uniqueKey} chainId={market.morphoBlue.chain.id} />
      </td>
      <td className="z-50 py-1 pl-4" style={{ minWidth: '240px' }}>
        <MarketIdentity
          market={market}
          chainId={market.morphoBlue.chain.id}
          mode={MarketIdentityMode.Minimum}
          focus={MarketIdentityFocus.Collateral}
          showLltv
          showOracle
          iconSize={20}
          showExplorerLink={false}
        />
      </td>
      {columnVisibility.trustedBy && (
        <td data-label="Trusted By" className="z-50 py-1 text-center" style={{ minWidth: '110px' }}>
          <TrustedByCell vaults={trustedVaults} />
        </td>
      )}
      {columnVisibility.totalSupply && (
        <td data-label="Total Supply" className="z-50 py-1 text-center" style={{ minWidth: '120px' }}>
          <p className="text-xs">
            {formatAmountDisplay(market.state.supplyAssets, market.loanAsset.decimals)}
          </p>
        </td>
      )}
      {columnVisibility.totalBorrow && (
        <td data-label="Total Borrow" className="z-50 py-1 text-center" style={{ minWidth: '120px' }}>
          <p className="text-xs">
            {formatAmountDisplay(market.state.borrowAssets, market.loanAsset.decimals)}
          </p>
        </td>
      )}
      {columnVisibility.liquidity && (
        <td data-label="Liquidity" className="z-50 py-1 text-center" style={{ minWidth: '120px' }}>
          <p className="text-xs">
            {formatAmountDisplay(market.state.liquidityAssets, market.loanAsset.decimals)}
          </p>
        </td>
      )}
      {columnVisibility.supplyAPY && (
        <td data-label="Supply APY" className="z-50 py-1 text-center" style={{ minWidth: '100px' }}>
          <div className="flex items-center justify-center">
            <p className="text-sm">
              {market.state.supplyApy ? `${(market.state.supplyApy * 100).toFixed(2)}` : '—'}
            </p>
            {market.state.supplyApy && <span className="ml-0.5 text-xs"> % </span>}
          </div>
        </td>
      )}
      {columnVisibility.borrowAPY && (
        <td data-label="Borrow APY" className="z-50 py-1 text-center" style={{ minWidth: '100px' }}>
          <p className="text-sm">
            {market.state.borrowApy ? `${(market.state.borrowApy * 100).toFixed(2)}%` : '—'}
          </p>
        </td>
      )}
      {columnVisibility.rateAtTarget && (
        <td data-label="Target Rate" className="z-50 py-1 text-center" style={{ minWidth: '110px' }}>
          <p className="text-sm">
            {market.state.apyAtTarget ? `${(market.state.apyAtTarget * 100).toFixed(2)}%` : '—'}
          </p>
        </td>
      )}
      <td data-label="Indicators" className="z-50 py-1 text-center" style={{ minWidth: '100px' }}>
        <MarketIndicators market={market} showRisk />
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return (
    prevProps.marketWithSelection.market.uniqueKey === nextProps.marketWithSelection.market.uniqueKey &&
    prevProps.marketWithSelection.isSelected === nextProps.marketWithSelection.isSelected &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.showSelectColumn === nextProps.showSelectColumn &&
    JSON.stringify(prevProps.columnVisibility) === JSON.stringify(nextProps.columnVisibility)
  );
});

MarketTableRow.displayName = 'MarketTableRow';

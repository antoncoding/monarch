import { Tooltip } from '@/components/ui/tooltip';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';

type Collateral = {
  address: string;
  symbol: string;
  amount: number;
};

type MoreCollateralsBadgeProps = {
  collaterals: Collateral[];
  chainId: number;
  badgeSize?: number;
};

function MoreCollateralsBadge({ collaterals, chainId, badgeSize = 20 }: MoreCollateralsBadgeProps) {
  if (collaterals.length === 0) return null;

  return (
    <Tooltip
      content={
        <TooltipContent
          title={<span className="text-sm font-semibold">More collaterals</span>}
          detail={
            <div className="flex flex-col gap-2">
              {collaterals.map((collateral, index) => (
                <div
                  key={`${collateral.address}-${index}`}
                  className="flex items-center gap-2"
                >
                  <TokenIcon
                    address={collateral.address}
                    chainId={chainId}
                    symbol={collateral.symbol}
                    width={16}
                    height={16}
                  />
                  <span className="text-sm">{collateral.symbol}</span>
                </div>
              ))}
            </div>
          }
        />
      }
    >
      <span
        className="-ml-2 flex items-center justify-center rounded-full border border-background/40 bg-hovered text-[11px] text-secondary"
        style={{
          width: badgeSize,
          height: badgeSize,
          zIndex: 0,
        }}
      >
        +{collaterals.length}
      </span>
    </Tooltip>
  );
}

type CollateralIconsDisplayProps = {
  collaterals: Collateral[];
  chainId: number;
  maxDisplay?: number;
  iconSize?: number;
};

/**
 * Display collateral icons with smart overflow handling.
 *
 * Shows up to `maxDisplay` collateral icons in an overlapping style,
 * with a "+X more" badge for additional collaterals (with tooltip).
 *
 * Collaterals are automatically sorted by amount (descending).
 *
 * @example
 * <CollateralIconsDisplay
 *   collaterals={groupedPosition.collaterals}
 *   chainId={groupedPosition.chainId}
 *   maxDisplay={8}
 *   iconSize={20}
 * />
 */
export function CollateralIconsDisplay({ collaterals, chainId, maxDisplay = 8, iconSize = 20 }: CollateralIconsDisplayProps) {
  if (collaterals.length === 0) {
    return <span className="text-sm text-gray-500"> - </span>;
  }

  // Sort by amount descending
  const sortedCollaterals = [...collaterals].sort((a, b) => b.amount - a.amount);

  // Split into preview and overflow
  const preview = sortedCollaterals.slice(0, maxDisplay);
  const remaining = sortedCollaterals.slice(maxDisplay);

  return (
    <div className="flex items-center justify-center">
      {preview.map((collateral, index) => (
        <div
          key={`${collateral.address}-${index}`}
          className={`relative ${index === 0 ? 'ml-0' : '-ml-2'}`}
          style={{ zIndex: preview.length - index }}
        >
          <TokenIcon
            address={collateral.address}
            chainId={chainId}
            symbol={collateral.symbol}
            width={iconSize}
            height={iconSize}
            opacity={collateral.amount > 0 ? 1 : 0.5}
          />
        </div>
      ))}
      {remaining.length > 0 && (
        <MoreCollateralsBadge
          collaterals={remaining}
          chainId={chainId}
          badgeSize={iconSize}
        />
      )}
    </div>
  );
}

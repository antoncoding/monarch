import { TokenIcon } from '@/components/TokenIcon';
import { Market } from '@/utils/types';
import { SupportedNetworks } from '@/utils/networks';
import { formatAllocationAmount, calculateAllocationPercent } from '@/utils/vaultAllocation';
import { getTruncatedAssetName } from '@/utils/oracle';
import { AllocationPieChart } from './AllocationPieChart';

type MarketItem = {
  market: Market;
  allocation: bigint;
};

type MarketViewProps = {
  items: MarketItem[];
  totalAllocation: bigint;
  vaultAssetSymbol: string;
  vaultAssetDecimals: number;
  chainId: SupportedNetworks;
};

export function MarketView({
  items,
  totalAllocation,
  vaultAssetSymbol,
  vaultAssetDecimals,
  chainId,
}: MarketViewProps) {
  // Sort by allocation amount (most to least)
  const sortedItems = [...items].sort((a, b) => {
    if (a.allocation > b.allocation) return -1;
    if (a.allocation < b.allocation) return 1;
    return 0;
  });

  return (
    <div className="space-y-2">
      {sortedItems.map((item) => {
        const { market, allocation } = item;
        const percentage =
          totalAllocation > 0n ? parseFloat(calculateAllocationPercent(allocation, totalAllocation)) : 0;
        const supplyApy = (market.state.supplyApy * 100).toFixed(2);
        const lltv = (Number(market.lltv) / 1e16).toFixed(0);

        return (
          <div
            key={market.uniqueKey}
            className="rounded bg-hovered/20 p-4 flex items-center justify-between gap-4"
          >
            {/* Market Identity */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center flex-shrink-0">
                <div className="z-10">
                  <TokenIcon
                    address={market.loanAsset.address}
                    chainId={chainId}
                    symbol={market.loanAsset.symbol}
                    width={20}
                    height={20}
                  />
                </div>
                <div className="bg-surface -ml-2.5">
                  <TokenIcon
                    address={market.collateralAsset.address}
                    chainId={chainId}
                    symbol={market.collateralAsset.symbol}
                    width={20}
                    height={20}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">
                  {getTruncatedAssetName(market.loanAsset.symbol)}
                </span>
                <span className="text-xs opacity-50 flex-shrink-0">
                  / {getTruncatedAssetName(market.collateralAsset.symbol)}
                </span>
              </div>
            </div>

            {/* Market Stats */}
            <div className="flex items-center gap-4 text-xs text-secondary flex-shrink-0">
              <div className="text-right">
                <span className="font-semibold">{supplyApy}%</span>
                <span className="ml-1">APY</span>
              </div>
              <div className="text-right">
                <span className="font-semibold">{lltv}%</span>
                <span className="ml-1">LLTV</span>
              </div>
            </div>

            {/* Allocation */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                {allocation > 0n ? (
                  <>
                    <p className="text-sm font-semibold">
                      {formatAllocationAmount(allocation, vaultAssetDecimals)} {vaultAssetSymbol}
                    </p>
                    <p className="text-xs text-secondary">{percentage.toFixed(2)}% of total</p>
                  </>
                ) : (
                  <p className="text-xs text-secondary">No allocation</p>
                )}
              </div>
              <AllocationPieChart percentage={percentage} size={20} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

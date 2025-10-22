import { MarketIdentity, MarketIdentityFocus } from '@/components/MarketIdentity';
import { Market } from '@/utils/types';
import { SupportedNetworks } from '@/utils/networks';
import { formatAllocationAmount, calculateAllocationPercent } from '@/utils/vaultAllocation';
import { formatBalance, formatReadable } from '@/utils/balance';
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
    <div className="overflow-x-auto">
      <table className="w-full font-zen">
        <thead>
          <tr className="text-xs text-secondary">
            <th className="pb-3 text-left font-normal">Market</th>
            <th className="pb-3 text-right font-normal">APY</th>
            <th className="pb-3 text-right font-normal">Total Supply</th>
            <th className="pb-3 text-right font-normal">Liquidity</th>
            <th className="pb-3 text-right font-normal">Amount</th>
            <th className="pb-3 text-right font-normal">Allocation</th>
            <th className="pb-3 text-center font-normal w-10"></th>
          </tr>
        </thead>
        <tbody className="space-y-2">
          {sortedItems.map((item) => {
            const { market, allocation } = item;
            const percentage =
              totalAllocation > 0n ? parseFloat(calculateAllocationPercent(allocation, totalAllocation)) : 0;
            const supplyApy = (market.state.supplyApy * 100).toFixed(2);
            const hasAllocation = allocation > 0n;
            const totalSupply = formatReadable(
              formatBalance(BigInt(market.state.supplyAssets || 0), market.loanAsset.decimals).toString()
            );
            const liquidity = formatReadable(
              formatBalance(BigInt(market.state.liquidityAssets || 0), market.loanAsset.decimals).toString()
            );

            return (
              <tr key={market.uniqueKey} className="rounded bg-hovered/20">
                {/* Market Info Column */}
                <td className="p-3 rounded-l">
                  <MarketIdentity
                    market={market}
                    chainId={chainId}
                    focus={MarketIdentityFocus.Collateral}
                    showLltv={true}
                    showOracle={true}
                    iconSize={20}
                    showExplorerLink={true}
                  />
                </td>

                {/* APY */}
                <td className="p-3 text-right text-xs text-secondary whitespace-nowrap">
                  {supplyApy}%
                </td>

                {/* Total Supply */}
                <td className="p-3 text-right text-xs text-secondary whitespace-nowrap">
                  {totalSupply}
                </td>

                {/* Liquidity */}
                <td className="p-3 text-right text-xs text-secondary whitespace-nowrap">
                  {liquidity}
                </td>

                {/* Allocation Amount */}
                <td className={`p-3 text-right text-sm ${hasAllocation ? '' : 'text-secondary'}`}>
                  <span className="whitespace-nowrap">
                    {hasAllocation
                      ? `${formatAllocationAmount(allocation, vaultAssetDecimals)} ${vaultAssetSymbol}`
                      : '-'}
                  </span>
                </td>

                {/* Allocation Percentage */}
                <td className={`p-3 text-right text-sm ${hasAllocation ? 'text-primary' : 'text-secondary'}`}>
                  <span className="whitespace-nowrap">
                    {hasAllocation ? `${percentage.toFixed(2)}%` : '—'}
                  </span>
                </td>

                {/* Pie Chart */}
                <td className="p-3 rounded-r w-10">
                  <div className="flex justify-center">
                    <AllocationPieChart percentage={percentage} size={20} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { MarketIdentity, MarketIdentityFocus } from '@/features/markets/components/market-identity';
import { useMarkets } from '@/hooks/useMarkets';
import { useRateLabel } from '@/hooks/useRateLabel';
import type { MarketAllocation } from '@/types/vaultAllocations';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';
import { calculateAllocationPercent } from '@/utils/vaultAllocation';
import { AllocationCell } from '@/features/positions/components/allocation-cell';

type MarketViewProps = {
  allocations: MarketAllocation[];
  totalAllocation: bigint;
  vaultAssetSymbol: string;
  vaultAssetDecimals: number;
  chainId: SupportedNetworks;
};

export function MarketView({ allocations, totalAllocation, vaultAssetSymbol, vaultAssetDecimals, chainId }: MarketViewProps) {
  const { isAprDisplay } = useMarkets();
  const { short: rateLabel } = useRateLabel();

  // Sort by allocation amount (most to least)
  const sortedItems = [...allocations].sort((a, b) => {
    if (a.allocation > b.allocation) return -1;
    if (a.allocation < b.allocation) return 1;
    return 0;
  });

  return (
    <div className="overflow-x-auto">
      <Table className="w-full font-zen">
        <TableHeader>
          <TableRow className="text-xs text-secondary">
            <TableHead className="pb-3 text-left font-normal">Market</TableHead>
            <TableHead className="pb-3 text-right font-normal">{rateLabel}</TableHead>
            <TableHead className="pb-3 text-right font-normal">Total Supply</TableHead>
            <TableHead className="pb-3 text-right font-normal">Liquidity</TableHead>
            <TableHead className="pb-3 text-right font-normal">Allocation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="space-y-2">
          {sortedItems.map((item) => {
            const { market, allocation } = item;
            const percentage = totalAllocation > 0n ? Number.parseFloat(calculateAllocationPercent(allocation, totalAllocation)) : 0;
            const displayRate = isAprDisplay ? convertApyToApr(market.state.supplyApy) : market.state.supplyApy;
            const supplyRate = (displayRate * 100).toFixed(2);
            const totalSupply = formatReadable(formatBalance(BigInt(market.state.supplyAssets || 0), market.loanAsset.decimals).toString());
            const liquidity = formatReadable(
              formatBalance(BigInt(market.state.liquidityAssets || 0), market.loanAsset.decimals).toString(),
            );
            // Calculate amount as number for AllocationCell
            const allocatedAmount = formatBalance(allocation, vaultAssetDecimals);

            return (
              <TableRow
                key={market.uniqueKey}
                className="rounded bg-hovered/20"
              >
                {/* Market Info Column */}
                <TableCell className="p-3 rounded-l">
                  <MarketIdentity
                    market={market}
                    chainId={chainId}
                    focus={MarketIdentityFocus.Collateral}
                    showLltv
                    showOracle
                    iconSize={20}
                    showExplorerLink
                  />
                </TableCell>

                {/* APY/APR */}
                <TableCell className="p-3 text-right text-xs text-secondary whitespace-nowrap">{supplyRate}%</TableCell>

                {/* Total Supply */}
                <TableCell className="p-3 text-right text-xs text-secondary whitespace-nowrap">{totalSupply}</TableCell>

                {/* Liquidity */}
                <TableCell className="p-3 text-right text-xs text-secondary whitespace-nowrap">{liquidity}</TableCell>

                {/* Allocation */}
                <TableCell className="p-3 rounded-r align-middle">
                  <AllocationCell
                    amount={allocatedAmount}
                    symbol={vaultAssetSymbol}
                    percentage={percentage}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TokenIcon } from '@/components/TokenIcon';
import type { CollateralAllocation } from '@/types/vaultAllocations';
import type { SupportedNetworks } from '@/utils/networks';
import { formatAllocationAmount, calculateAllocationPercent } from '@/utils/vaultAllocation';
import { AllocationPieChart } from './AllocationPieChart';

type CollateralViewProps = {
  allocations: CollateralAllocation[];
  totalAllocation: bigint;
  vaultAssetSymbol: string;
  vaultAssetDecimals: number;
  chainId: SupportedNetworks;
};

export function CollateralView({ allocations, totalAllocation, vaultAssetSymbol, vaultAssetDecimals, chainId }: CollateralViewProps) {
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
            <TableHead className="pb-3 text-left font-normal">Collateral</TableHead>
            <TableHead className="pb-3 text-right font-normal">Amount</TableHead>
            <TableHead className="pb-3 text-right font-normal">Allocation</TableHead>
            <TableHead className="pb-3 text-center font-normal w-10" />
          </TableRow>
        </TableHeader>
        <TableBody className="space-y-2">
          {sortedItems.map((item) => {
            const percentage = totalAllocation > 0n ? Number.parseFloat(calculateAllocationPercent(item.allocation, totalAllocation)) : 0;
            const hasAllocation = item.allocation > 0n;

            return (
              <TableRow
                key={item.collateralAddress.toLowerCase()}
                className="rounded bg-hovered/20"
              >
                <TableCell className="p-3 rounded-l">
                  <div className="flex items-center gap-3">
                    <TokenIcon
                      address={item.collateralAddress}
                      chainId={chainId}
                      width={24}
                      height={24}
                    />
                    <span className="text-sm whitespace-nowrap">{item.collateralSymbol}</span>
                  </div>
                </TableCell>
                <TableCell className={`p-3 text-right text-sm ${hasAllocation ? '' : 'text-secondary'}`}>
                  <span className="whitespace-nowrap">
                    {hasAllocation ? `${formatAllocationAmount(item.allocation, vaultAssetDecimals)} ${vaultAssetSymbol}` : '-'}
                  </span>
                </TableCell>
                <TableCell className={`p-3 text-right text-sm ${hasAllocation ? 'text-primary' : 'text-secondary'}`}>
                  <span className="whitespace-nowrap">{hasAllocation ? `${percentage.toFixed(2)}%` : '-'}</span>
                </TableCell>
                <TableCell className="p-3 rounded-r w-10">
                  <div className="flex justify-center">
                    <AllocationPieChart
                      percentage={percentage}
                      size={20}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

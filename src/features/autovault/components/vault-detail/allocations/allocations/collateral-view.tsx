import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TokenIcon } from '@/components/shared/token-icon';
import type { CollateralAllocation } from '@/types/vaultAllocations';
import type { SupportedNetworks } from '@/utils/networks';
import { formatBalance } from '@/utils/balance';
import { calculateAllocationPercent } from '@/utils/vaultAllocation';
import { AllocationCell } from '@/features/positions/components/allocation-cell';

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
    <Table className="w-full font-zen">
      <TableHeader>
        <TableRow className="text-xs text-secondary">
          <TableHead className="pb-3 text-left font-normal">Collateral</TableHead>
          <TableHead className="pb-3 text-right font-normal">Allocation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="space-y-2">
        {sortedItems.map((item) => {
          const percentage = totalAllocation > 0n ? Number.parseFloat(calculateAllocationPercent(item.allocation, totalAllocation)) : 0;
          // Calculate amount as number for AllocationCell
          const allocatedAmount = formatBalance(item.allocation, vaultAssetDecimals);

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
  );
}

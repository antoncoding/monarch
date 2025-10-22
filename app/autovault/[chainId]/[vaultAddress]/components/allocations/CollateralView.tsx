import { Address } from 'viem';
import { TokenIcon } from '@/components/TokenIcon';
import { SupportedNetworks } from '@/utils/networks';
import { formatAllocationAmount, calculateAllocationPercent } from '@/utils/vaultAllocation';
import { AllocationPieChart } from './AllocationPieChart';

type CollateralItem = {
  collateralAddress: Address;
  collateralSymbol: string;
  allocation: bigint;
};

type CollateralViewProps = {
  items: CollateralItem[];
  totalAllocation: bigint;
  vaultAssetSymbol: string;
  vaultAssetDecimals: number;
  chainId: SupportedNetworks;
};

export function CollateralView({
  items,
  totalAllocation,
  vaultAssetSymbol,
  vaultAssetDecimals,
  chainId,
}: CollateralViewProps) {
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
            <th className="pb-3 text-left font-normal">Collateral</th>
            <th className="pb-3 text-right font-normal">Amount</th>
            <th className="pb-3 text-right font-normal">Allocation</th>
            <th className="pb-3 text-center font-normal w-10"></th>
          </tr>
        </thead>
        <tbody className="space-y-2">
          {sortedItems.map((item) => {
            const percentage =
              totalAllocation > 0n ? parseFloat(calculateAllocationPercent(item.allocation, totalAllocation)) : 0;
            const hasAllocation = item.allocation > 0n;

            return (
              <tr key={item.collateralAddress.toLowerCase()} className="rounded bg-hovered/20">
                <td className="p-3 rounded-l">
                  <div className="flex items-center gap-3">
                    <TokenIcon address={item.collateralAddress} chainId={chainId} width={24} height={24} />
                    <span className="text-sm whitespace-nowrap">{item.collateralSymbol}</span>
                  </div>
                </td>
                <td className={`p-3 text-right text-sm ${hasAllocation ? '' : 'text-secondary'}`}>
                  <span className="whitespace-nowrap">
                    {hasAllocation
                      ? `${formatAllocationAmount(item.allocation, vaultAssetDecimals)} ${vaultAssetSymbol}`
                      : '-'}
                  </span>
                </td>
                <td className={`p-3 text-right text-sm ${hasAllocation ? 'text-primary' : 'text-secondary'}`}>
                  <span className="whitespace-nowrap">
                    {hasAllocation ? `${percentage.toFixed(2)}%` : '—'}
                  </span>
                </td>
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

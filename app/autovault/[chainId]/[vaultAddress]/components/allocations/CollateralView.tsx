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
    <div className="space-y-2">
      {sortedItems.map((item) => {
        const percentage =
          totalAllocation > 0n ? parseFloat(calculateAllocationPercent(item.allocation, totalAllocation)) : 0;

        return (
          <div
            key={item.collateralAddress.toLowerCase()}
            className="rounded bg-hovered/20 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <TokenIcon address={item.collateralAddress} chainId={chainId} width={24} height={24} />
              <div>
                <p className="font-medium text-sm">{item.collateralSymbol}</p>
                <p className="text-xs text-secondary">Collateral</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                {item.allocation > 0n ? (
                  <>
                    <p className="text-sm font-semibold">
                      {formatAllocationAmount(item.allocation, vaultAssetDecimals)} {vaultAssetSymbol}
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

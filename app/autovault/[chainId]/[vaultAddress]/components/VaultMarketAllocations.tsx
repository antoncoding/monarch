import OracleVendorBadge from '@/components/OracleVendorBadge';
import { TokenIcon } from '@/components/TokenIcon';
import { VaultAllocation } from '@/hooks/useAutovaultData';

const formatPercent = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : '--';

const formatApy = formatPercent;

type VaultMarketAllocationsProps = {
  allocations: VaultAllocation[];
  vaultAssetSymbol: string;
};

export function VaultMarketAllocations({ allocations, vaultAssetSymbol }: VaultMarketAllocationsProps) {
  if (allocations.length === 0) {
    return (
      <div className="bg-surface rounded p-6 text-center font-zen text-secondary">
        No markets supplied yet. Configure your strategy to start allocating assets.
      </div>
    );
  }

  return (
    <div className="bg-surface rounded p-4 shadow-sm font-zen">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg text-secondary">Active Markets</p>
          <p className="text-xs text-secondary">Supply allocations managed by this vault.</p>
        </div>
        <div className="rounded bg-hovered px-3 py-1 text-xs uppercase text-secondary">
          Vault asset: {vaultAssetSymbol}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="responsive w-full font-zen text-sm">
          <thead className="table-header">
            <tr>
              <th className="font-normal">ID</th>
              <th className="font-normal">Allocation</th>
              <th className="font-normal">APY</th>
              <th className="font-normal">Risk</th>
              <th className="font-normal">Vault Share</th>
            </tr>
          </thead>
          <tbody className="table-body">
            {allocations.map((allocation) => (
              <tr key={allocation.marketId}>
                <td data-label="ID">
                  <div className="flex items-center justify-center gap-2">
                    <TokenIcon
                      address={allocation.collateralAddress}
                      chainId={allocation.chainId}
                      symbol={allocation.collateralSymbol}
                      width={16}
                      height={16}
                    />
                    <span className="rounded bg-hovered px-2 py-0.5 font-monospace text-xs uppercase text-secondary">
                      {allocation.marketId}
                    </span>
                  </div>
                </td>
                <td data-label="Allocation">
                  {allocation.allocationFormatted ?? `-- ${vaultAssetSymbol}`}
                </td>
                <td data-label="APY">{formatApy(allocation.apy)}</td>
                <td data-label="Risk">
                  <div className="flex flex-col items-center gap-1">
                    <span className="rounded bg-hovered px-2 py-0.5 text-xs text-secondary">
                      LLTV {formatPercent(allocation.lltv)}
                    </span>
                    <OracleVendorBadge
                      oracleData={allocation.oracleData}
                      chainId={allocation.chainId}
                    />
                  </div>
                </td>
                <td data-label="Vault Share">{formatPercent(allocation.allocationPercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

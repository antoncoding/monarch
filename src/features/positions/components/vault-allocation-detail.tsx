import { useMemo } from 'react';
import type { Address } from 'viem';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketRiskIndicators } from '@/features/markets/components/market-risk-indicators';
import { APYCell } from '@/features/markets/components/apy-breakdown-tooltip';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useVaultAllocations } from '@/hooks/useVaultAllocations';
import { formatBalance } from '@/utils/balance';
import { parseCapIdParams } from '@/utils/morpho';
import { AllocationCell } from './allocation-cell';

type VaultAllocationDetailProps = {
  vault: UserVaultV2;
};

export function VaultAllocationDetail({ vault }: VaultAllocationDetailProps) {
  const { short: rateLabel } = useRateLabel();

  // Fetch actual allocations - useVaultAllocations pulls caps internally
  const { marketAllocations, loading } = useVaultAllocations({
    vaultAddress: vault.address as Address,
    chainId: vault.networkId,
    enabled: true,
  });

  // Calculate total allocation for percentage calculation
  const totalAllocation = useMemo(() => {
    return marketAllocations.reduce((sum, a) => sum + a.allocation, 0n);
  }, [marketAllocations]);

  // Get vault asset token info for display
  const vaultAssetDecimals = marketAllocations[0]?.market.loanAsset.decimals ?? 18;
  const vaultAssetSymbol = marketAllocations[0]?.market.loanAsset.symbol ?? vault.asset;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="bg-surface bg-opacity-20 flex items-center justify-center p-4">
          <Spinner size={24} />
        </div>
      </motion.div>
    );
  }

  if (marketAllocations.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="bg-surface bg-opacity-20 p-4 text-center text-sm text-secondary">
          No market allocations configured for this vault.
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="bg-surface bg-opacity-20">
        <Table className="no-hover-effect w-full font-zen">
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>{rateLabel}</TableHead>
              <TableHead>Allocation</TableHead>
              <TableHead>Risk Tiers</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {marketAllocations.map((allocation) => {
              // Calculate allocated amount
              const allocatedAmount = Number(formatBalance(allocation.allocation, vaultAssetDecimals));

              // Calculate percentage
              const percentage =
                totalAllocation > 0n ? (allocatedAmount / Number(formatBalance(totalAllocation, vaultAssetDecimals))) * 100 : 0;

              return (
                <TableRow
                  key={allocation.market.uniqueKey}
                  className="gap-1"
                >
                  {/* Market */}
                  <TableCell
                    data-label="Market"
                    className="align-middle p-4"
                  >
                    <MarketIdentity
                      market={allocation.market}
                      mode={MarketIdentityMode.Focused}
                      focus={MarketIdentityFocus.Collateral}
                      chainId={vault.networkId}
                      showId
                      showOracle
                      showLltv
                    />
                  </TableCell>

                  {/* APY/APR */}
                  <TableCell
                    data-label={rateLabel}
                    className="text-center"
                  >
                    <APYCell market={allocation.market} />
                  </TableCell>

                  {/* Allocation */}
                  <TableCell
                    data-label="Allocation"
                    className="align-middle"
                  >
                    <AllocationCell
                      amount={allocatedAmount}
                      symbol={vaultAssetSymbol}
                      percentage={percentage}
                    />
                  </TableCell>

                  {/* Risk Tiers */}
                  <TableCell
                    data-label="Risk Tiers"
                    className="text-center align-middle"
                    style={{ maxWidth: '120px' }}
                  >
                    <MarketRiskIndicators
                      market={allocation.market}
                      mode="complex"
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell
                    data-label="Actions"
                    className="justify-end px-4 py-3"
                    style={{ minWidth: '180px' }}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="surface"
                        disabled
                      >
                        Edit Cap
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}

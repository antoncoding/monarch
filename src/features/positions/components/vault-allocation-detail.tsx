import { useMemo } from 'react';
import type { Address } from 'viem';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketIndicators } from '@/features/markets/components/market-indicators';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useVaultAllocations } from '@/hooks/useVaultAllocations';
import { RateFormatted } from '@/components/shared/rate-formatted';
import { formatBalance } from '@/utils/balance';
import { parseCapIdParams } from '@/utils/morpho';
import { SuppliedAmountCell } from './supplied-amount-cell';
import { SuppliedPercentageCell } from './supplied-percentage-cell';

type VaultAllocationDetailProps = {
  vault: UserVaultV2;
};

export function VaultAllocationDetail({ vault }: VaultAllocationDetailProps) {
  const { short: rateLabel } = useRateLabel();

  // Separate collateral and market caps
  const { collateralCaps, marketCaps } = useMemo(() => {
    const collat: typeof vault.caps = [];
    const market: typeof vault.caps = [];

    vault.caps.forEach((cap) => {
      const params = parseCapIdParams(cap.idParams);
      if (params.type === 'collateral') {
        collat.push(cap);
      } else if (params.type === 'market') {
        market.push(cap);
      }
    });

    return { collateralCaps: collat, marketCaps: market };
  }, [vault.caps]);

  // Fetch actual allocations
  const { marketAllocations, loading } = useVaultAllocations({
    collateralCaps,
    marketCaps,
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
              <TableHead>Collateral & Parameters</TableHead>
              <TableHead>{rateLabel}</TableHead>
              <TableHead>Supplied</TableHead>
              <TableHead>% of Portfolio</TableHead>
              <TableHead>Indicators</TableHead>
              <TableHead>Actions</TableHead>
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
                  {/* Market ID Badge */}
                  <TableCell
                    data-label="Market"
                    className="text-center"
                  >
                    <div className="flex items-center justify-center">
                      <MarketIdBadge
                        marketId={allocation.market.uniqueKey}
                        chainId={vault.networkId}
                        showNetworkIcon={false}
                      />
                    </div>
                  </TableCell>

                  {/* Collateral & Parameters */}
                  <TableCell
                    data-label="Market Detail"
                    className="align-middle p-4"
                  >
                    <MarketIdentity
                      market={allocation.market}
                      mode={MarketIdentityMode.Minimum}
                      focus={MarketIdentityFocus.Collateral}
                      chainId={vault.networkId}
                      wide
                    />
                  </TableCell>

                  {/* APY/APR */}
                  <TableCell
                    data-label={rateLabel}
                    className="text-center"
                  >
                    <RateFormatted value={allocation.market.state.supplyApy} />
                  </TableCell>

                  {/* Supplied */}
                  <TableCell
                    data-label="Supplied"
                    className="text-center"
                  >
                    <SuppliedAmountCell
                      amount={allocatedAmount}
                      symbol={vaultAssetSymbol}
                    />
                  </TableCell>

                  {/* % of Portfolio */}
                  <TableCell
                    data-label="% of Portfolio"
                    className="text-center"
                  >
                    <SuppliedPercentageCell percentage={percentage} />
                  </TableCell>

                  {/* Indicators */}
                  <TableCell
                    data-label="Indicators"
                    className="text-center"
                  >
                    <MarketIndicators
                      market={allocation.market}
                      showRisk
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell
                    data-label="Actions"
                    className="justify-center px-4 py-3"
                  >
                    <div className="flex items-center justify-center gap-2">
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

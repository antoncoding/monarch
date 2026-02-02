'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketRiskIndicators } from '@/features/markets/components/market-risk-indicators';
import { APYCell } from '@/features/markets/components/apy-breakdown-tooltip';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useModal } from '@/hooks/useModal';
import { formatBalance } from '@/utils/balance';
import type { MarketPosition, GroupedPosition } from '@/utils/types';
import { AllocationCell } from './allocation-cell';
import { UserPositionsChart } from './user-positions-chart';
import type { UserTransaction } from '@/utils/types';
import type { PositionSnapshot } from '@/utils/positions';

type SuppliedMarketsDetailProps = {
  groupedPosition: GroupedPosition;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  chainBlockData: Record<number, { block: number; timestamp: number }>;
};

function MarketRow({ position, totalSupply, rateLabel }: { position: MarketPosition; totalSupply: number; rateLabel: string }) {
  const { open } = useModal();
  const suppliedAmount = Number(formatBalance(position.state.supplyAssets, position.market.loanAsset.decimals));
  const percentageOfPortfolio = totalSupply > 0 ? (suppliedAmount / totalSupply) * 100 : 0;

  return (
    <TableRow
      key={position.market.uniqueKey}
      className="gap-1"
    >
      <TableCell
        data-label="Market"
        className="align-middle p-4"
      >
        <MarketIdentity
          market={position.market}
          mode={MarketIdentityMode.Focused}
          focus={MarketIdentityFocus.Collateral}
          chainId={position.market.morphoBlue.chain.id}
          showId
          showOracle
          showLltv
        />
      </TableCell>
      <TableCell
        data-label={rateLabel}
        className="text-center"
      >
        <APYCell market={position.market} />
      </TableCell>
      <TableCell
        data-label="Allocation"
        className="align-middle"
      >
        <AllocationCell
          amount={suppliedAmount}
          symbol={position.market.loanAsset.symbol}
          percentage={percentageOfPortfolio}
        />
      </TableCell>
      <TableCell
        data-label="Risk Tiers"
        className="text-center align-middle"
        style={{ maxWidth: '120px' }}
      >
        <MarketRiskIndicators
          market={position.market}
          mode="complex"
        />
      </TableCell>
      <TableCell
        data-label="Actions"
        className="justify-end px-4 py-3"
        style={{ minWidth: '180px' }}
      >
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="surface"
            onClick={() => {
              open('supply', {
                market: position.market,
                position,
                defaultMode: 'withdraw',
              });
            }}
          >
            Withdraw
          </Button>
          <Button
            size="sm"
            variant="surface"
            onClick={() => {
              open('supply', {
                market: position.market,
                position,
              });
            }}
          >
            Supply
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// shared similar style with @vault-allocation-detail.tsx
export function SuppliedMarketsDetail({ groupedPosition, transactions, snapshotsByChain, chainBlockData }: SuppliedMarketsDetailProps) {
  const { short: rateLabel } = useRateLabel();

  // Sort markets by size
  const sortedMarkets = [...groupedPosition.markets].sort(
    (a, b) =>
      Number(formatBalance(b.state.supplyAssets, b.market.loanAsset.decimals)) -
      Number(formatBalance(a.state.supplyAssets, a.market.loanAsset.decimals)),
  );

  const totalSupply = groupedPosition.totalSupply;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="bg-surface bg-opacity-20">
        {/* Position History Chart with synchronized pie */}
        <UserPositionsChart
          variant="grouped"
          groupedPosition={groupedPosition}
          transactions={transactions}
          snapshotsByChain={snapshotsByChain}
          chainBlockData={chainBlockData}
        />

        {/* Markets Table - Always visible */}
        <Table className="no-hover-effect w-full font-zen">
          <TableHeader className="">
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>{rateLabel}</TableHead>
              <TableHead>Allocation</TableHead>
              <TableHead>Risk Tiers</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {sortedMarkets.map((position) => (
              <MarketRow
                key={position.market.uniqueKey}
                position={position}
                totalSupply={totalSupply}
                rateLabel={rateLabel}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}

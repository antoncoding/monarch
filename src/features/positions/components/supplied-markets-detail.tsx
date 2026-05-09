'use client';

import { motion } from 'framer-motion';
import { PulseLoader } from 'react-spinners';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketRiskIndicators } from '@/features/markets/components/market-risk-indicators';
import { APYCell } from '@/features/markets/components/apy-breakdown-tooltip';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useModal } from '@/hooks/useModal';
import { formatBalance } from '@/utils/balance';
import { formatTokenAmountPreview } from '@/utils/token-amount-format';
import type { GroupedPosition, MarketPositionWithEarnings } from '@/utils/types';
import { AllocationCell } from './allocation-cell';
import { UserPositionsChart } from './user-positions-chart';
import type { UserTransaction } from '@/utils/types';
import { hasActiveSupplyPosition, type PositionSnapshot } from '@/utils/positions';

type SuppliedMarketsDetailProps = {
  groupedPosition: GroupedPosition;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  chainBlockData: Record<number, { block: number; timestamp: number }>;
  isEarningsLoading: boolean;
};

function MarketRow({
  position,
  totalSupply,
  rateLabel,
  isEarningsLoading,
}: {
  position: MarketPositionWithEarnings;
  totalSupply: number;
  rateLabel: string;
  isEarningsLoading: boolean;
}) {
  const { open } = useModal();
  const suppliedAmount = Number(formatBalance(position.state.supplyAssets, position.market.loanAsset.decimals));
  const percentageOfPortfolio = totalSupply > 0 ? (suppliedAmount / totalSupply) * 100 : 0;
  const earned = BigInt(position.earned ?? '0');
  const earnedPreview = earned === 0n ? null : formatTokenAmountPreview(earned, position.market.loanAsset.decimals);
  const hasActiveSupply = hasActiveSupplyPosition(position);

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
        className="text-center align-middle"
      >
        {hasActiveSupply ? (
          <AllocationCell
            amount={suppliedAmount}
            symbol={position.market.loanAsset.symbol}
            percentage={percentageOfPortfolio}
          />
        ) : (
          <span className="font-medium text-secondary">-</span>
        )}
      </TableCell>
      <TableCell
        data-label="Interest"
        className="text-center align-middle"
      >
        {isEarningsLoading ? (
          <PulseLoader
            size={4}
            color="#f45f2d"
            margin={3}
          />
        ) : earnedPreview ? (
          <span className="font-medium">
            {earnedPreview.compact} {position.market.loanAsset.symbol}
          </span>
        ) : (
          <span className="font-medium text-secondary">-</span>
        )}
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
          {hasActiveSupply && (
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
          )}
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
export function SuppliedMarketsDetail({
  groupedPosition,
  transactions,
  snapshotsByChain,
  chainBlockData,
  isEarningsLoading,
}: SuppliedMarketsDetailProps) {
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
      <div className="space-y-4">
        {isEarningsLoading ? (
          <div
            role="status"
            aria-label="Calculating earnings"
            className="flex min-h-[180px] items-center justify-center"
          >
            <PulseLoader
              size={5}
              color="#f45f2d"
              margin={4}
            />
          </div>
        ) : (
          <UserPositionsChart
            variant="grouped"
            groupedPosition={groupedPosition}
            transactions={transactions}
            snapshotsByChain={snapshotsByChain}
            chainBlockData={chainBlockData}
          />
        )}

        <TableContainerWithHeader title="Underlying Markets">
          <Table className="no-hover-effect w-full font-zen">
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>{rateLabel}</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Interest</TableHead>
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
                  isEarningsLoading={isEarningsLoading}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainerWithHeader>
      </div>
    </motion.div>
  );
}

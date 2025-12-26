import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketRiskIndicators } from '@/features/markets/components/market-risk-indicators';
import { APYCell } from '@/features/markets/components/apy-breakdown-tooltip';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useModal } from '@/hooks/useModal';
import { formatReadable, formatBalance } from '@/utils/balance';
import type { MarketPosition, GroupedPosition } from '@/utils/types';
import { getCollateralColor } from '@/features/positions/utils/colors';
import { AllocationCell } from './allocation-cell';
type SuppliedMarketsDetailProps = {
  groupedPosition: GroupedPosition;
  showCollateralExposure: boolean;
};

function MarketRow({
  position,
  totalSupply,
  rateLabel,
}: {
  position: MarketPosition;
  totalSupply: number;
  rateLabel: string;
}) {
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
                isMarketPage: false,
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
                isMarketPage: false,
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
  showCollateralExposure,
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
      <div className="bg-surface bg-opacity-20">
        {/* Conditionally render collateral exposure section */}
        {showCollateralExposure && (
          <div className="mb-4 flex items-center justify-center">
            <div className="my-4 w-1/2">
              <h3 className="mb-2 text-base font-semibold">Collateral Exposure</h3>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
                {groupedPosition.processedCollaterals.map((collateral, colIndex) => (
                  <div
                    key={`${collateral.address}-${colIndex}`}
                    className="h-full opacity-70"
                    style={{
                      width: `${collateral.percentage}%`,
                      backgroundColor: collateral.symbol === 'Others' ? '#A0AEC0' : getCollateralColor(collateral.address),
                    }}
                    title={`${collateral.symbol}: ${collateral.percentage.toFixed(2)}%`}
                  />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap justify-center text-xs">
                {groupedPosition.processedCollaterals.map((collateral, colIndex) => (
                  <span
                    key={`${collateral.address}-${colIndex}`}
                    className="mb-1 mr-2 opacity-70"
                  >
                    <span
                      style={{
                        color: collateral.symbol === 'Others' ? '#A0AEC0' : getCollateralColor(collateral.address),
                      }}
                    >
                      ■
                    </span>{' '}
                    {collateral.symbol}: {formatReadable(collateral.percentage)}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

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

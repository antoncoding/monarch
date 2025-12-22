import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { RateFormatted } from '@/components/shared/rate-formatted';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketIndicators } from '@/features/markets/components/market-indicators';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable, formatBalance } from '@/utils/balance';
import type { MarketPosition, GroupedPosition } from '@/utils/types';
import { getCollateralColor } from '@/features/positions/utils/colors';
type SuppliedMarketsDetailProps = {
  groupedPosition: GroupedPosition;
  setShowWithdrawModal: (show: boolean) => void;
  setShowSupplyModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
  showCollateralExposure: boolean;
};

function MarketRow({
  position,
  totalSupply,
  setShowWithdrawModal,
  setShowSupplyModal,
  setSelectedPosition,
  rateLabel,
}: {
  position: MarketPosition;
  totalSupply: number;
  setShowWithdrawModal: (show: boolean) => void;
  setShowSupplyModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
  rateLabel: string;
}) {
  const suppliedAmount = Number(formatBalance(position.state.supplyAssets, position.market.loanAsset.decimals));
  const percentageOfPortfolio = totalSupply > 0 ? (suppliedAmount / totalSupply) * 100 : 0;

  return (
    <TableRow
      key={position.market.uniqueKey}
      className="gap-1"
    >
      <TableCell
        data-label="Market"
        className="text-center"
      >
        <div className="flex items-center justify-center">
          <MarketIdBadge
            marketId={position.market.uniqueKey}
            chainId={position.market.morphoBlue.chain.id}
            showNetworkIcon={false}
          />
        </div>
      </TableCell>
      <TableCell
        data-label="Market Detail"
        className="align-middle p-4"
      >
        <MarketIdentity
          market={position.market}
          mode={MarketIdentityMode.Minimum}
          focus={MarketIdentityFocus.Collateral}
          chainId={position.market.morphoBlue.chain.id}
          wide
        />
      </TableCell>
      <TableCell
        data-label={rateLabel}
        className="text-center"
      >
        <RateFormatted value={position.market.state.supplyApy} />
      </TableCell>
      <TableCell
        data-label="Supplied"
        className="text-center"
      >
        {formatReadable(suppliedAmount)} {position.market.loanAsset.symbol}
      </TableCell>
      <TableCell
        data-label="% of Portfolio"
        className="text-center"
      >
        <div className="flex items-center">
          <div className="mr-2 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${percentageOfPortfolio}%` }}
            />
          </div>
          <span className="whitespace-nowrap">{formatReadable(percentageOfPortfolio)}%</span>
        </div>
      </TableCell>
      <TableCell
        data-label="Indicators"
        className="text-center"
      >
        <MarketIndicators
          market={position.market}
          showRisk
        />
      </TableCell>
      <TableCell
        data-label="Actions"
        className="justify-center px-4 py-3"
      >
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="surface"
            onClick={() => {
              setSelectedPosition(position);
              setShowWithdrawModal(true);
            }}
          >
            Withdraw
          </Button>
          <Button
            size="sm"
            variant="surface"
            onClick={() => {
              setSelectedPosition(position);
              setShowSupplyModal(true);
            }}
          >
            Supply
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SuppliedMarketsDetail({
  groupedPosition,
  setShowWithdrawModal,
  setShowSupplyModal,
  setSelectedPosition,
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
              <TableHead> Collateral & Parameters </TableHead>
              <TableHead>{rateLabel}</TableHead>
              <TableHead>Supplied</TableHead>
              <TableHead>% of Portfolio</TableHead>
              <TableHead>Indicators</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {sortedMarkets.map((position) => (
              <MarketRow
                key={position.market.uniqueKey}
                position={position}
                totalSupply={totalSupply}
                setShowWithdrawModal={setShowWithdrawModal}
                setShowSupplyModal={setShowSupplyModal}
                setSelectedPosition={setSelectedPosition}
                rateLabel={rateLabel}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}

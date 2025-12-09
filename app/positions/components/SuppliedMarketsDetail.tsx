import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RateFormatted } from '@/components/common/RateFormatted';
import { MarketIdBadge } from '@/components/MarketIdBadge';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/components/MarketIdentity';
import { MarketIndicators } from '@/components/MarketIndicators';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable, formatBalance } from '@/utils/balance';
import type { MarketPosition, GroupedPosition } from '@/utils/types';
import { getCollateralColor } from '../utils/colors';
type SuppliedMarketsDetailProps = {
  groupedPosition: GroupedPosition;
  setShowWithdrawModal: (show: boolean) => void;
  setShowSupplyModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
  showEmptyPositions: boolean;
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
    <tr
      key={position.market.uniqueKey}
      className="gap-1"
    >
      <td
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
      </td>
      <td
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
      </td>
      <td
        data-label={rateLabel}
        className="text-center"
      >
        <RateFormatted value={position.market.state.supplyApy} />
      </td>
      <td
        data-label="Supplied"
        className="text-center"
      >
        {formatReadable(suppliedAmount)} {position.market.loanAsset.symbol}
      </td>
      <td
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
      </td>
      <td
        data-label="Indicators"
        className="text-center"
      >
        <MarketIndicators
          market={position.market}
          showRisk
        />
      </td>
      <td
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
      </td>
    </tr>
  );
}

export function SuppliedMarketsDetail({
  groupedPosition,
  setShowWithdrawModal,
  setShowSupplyModal,
  setSelectedPosition,
  showEmptyPositions,
  showCollateralExposure,
}: SuppliedMarketsDetailProps) {
  const { short: rateLabel } = useRateLabel();

  // Sort active markets by size first
  const sortedMarkets = [...groupedPosition.markets].sort(
    (a, b) =>
      Number(formatBalance(b.state.supplyAssets, b.market.loanAsset.decimals)) -
      Number(formatBalance(a.state.supplyAssets, a.market.loanAsset.decimals)),
  );

  // Filter based on the showEmptyPositions prop
  const filteredMarkets = showEmptyPositions
    ? sortedMarkets
    : sortedMarkets.filter((position) => Number(formatBalance(position.state.supplyAssets, position.market.loanAsset.decimals)) > 0);

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
        <table className="no-hover-effect w-full font-zen">
          <thead className="table-header">
            <tr>
              <th>Market</th>
              <th> Collateral & Parameters </th>
              <th>{rateLabel}</th>
              <th>Supplied</th>
              <th>% of Portfolio</th>
              <th>Indicators</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="table-body text-xs">
            {filteredMarkets.map((position) => (
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
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

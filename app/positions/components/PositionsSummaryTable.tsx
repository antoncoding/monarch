import React, { useMemo, useState, useEffect } from 'react';
import { Spinner } from '@nextui-org/react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { GrRefresh } from 'react-icons/gr';
import { toast } from 'react-toastify';
import { TokenIcon } from '@/components/TokenIcon';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { MarketPosition, GroupedPosition, WarningWithDetail } from '@/utils/types';
import {
  MarketAssetIndicator,
  MarketOracleIndicator,
  MarketDebtIndicator,
} from 'app/markets/components/RiskIndicator';
import { RebalanceModal } from './RebalanceModal';
import { SuppliedMarketsDetail } from './SuppliedMarketsDetail';

type PositionsSummaryTableProps = {
  marketPositions: MarketPosition[];
  setShowWithdrawModal: (show: boolean) => void;
  setShowSupplyModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
};

export function PositionsSummaryTable({
  marketPositions,
  setShowWithdrawModal,
  setShowSupplyModal,
  setSelectedPosition,
  refetch,
  isRefetching,
}: PositionsSummaryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [selectedGroupedPosition, setSelectedGroupedPosition] = useState<GroupedPosition | null>(
    null,
  );

  const groupedPositions: GroupedPosition[] = useMemo(() => {
    return marketPositions.reduce((acc: GroupedPosition[], position) => {
      const loanAssetAddress = position.market.loanAsset.address;
      const loanAssetDecimals = position.market.loanAsset.decimals;
      const chainId = position.market.morphoBlue.chain.id;

      let groupedPosition = acc.find(
        (gp) => gp.loanAssetAddress === loanAssetAddress && gp.chainId === chainId,
      );

      if (!groupedPosition) {
        groupedPosition = {
          loanAsset: position.market.loanAsset.symbol || 'Unknown',
          loanAssetAddress,
          loanAssetDecimals,
          chainId,
          totalSupply: 0,
          totalWeightedApy: 0,
          collaterals: [],
          markets: [],
          processedCollaterals: [],
          allWarnings: [], // Initialize allWarnings as an empty array
        };
        acc.push(groupedPosition);
      }

      groupedPosition.markets.push(position);

      // Combine warnings from all markets
      groupedPosition.allWarnings = [
        ...new Set([...groupedPosition.allWarnings, ...(position.market.warningsWithDetail || [])]),
      ] as WarningWithDetail[];

      const supplyAmount = Number(
        formatBalance(position.supplyAssets, position.market.loanAsset.decimals),
      );
      groupedPosition.totalSupply += supplyAmount;

      const weightedApy = supplyAmount * position.market.state.supplyApy;
      groupedPosition.totalWeightedApy += weightedApy;

      const collateralAddress = position.market.collateralAsset?.address;
      const collateralSymbol = position.market.collateralAsset?.symbol;

      if (collateralAddress && collateralSymbol) {
        const existingCollateral = groupedPosition.collaterals.find(
          (c) => c.address === collateralAddress,
        );
        if (existingCollateral) {
          existingCollateral.amount += supplyAmount;
        } else {
          groupedPosition.collaterals.push({
            address: collateralAddress,
            symbol: collateralSymbol,
            amount: supplyAmount,
          });
        }
      }

      return acc;
    }, []);
  }, [marketPositions]);

  const processedPositions = useMemo(() => {
    return groupedPositions.map((position) => {
      const sortedCollaterals = [...position.collaterals].sort((a, b) => b.amount - a.amount);
      const totalSupply = position.totalSupply;
      const processedCollaterals = [];
      let othersAmount = 0;

      for (const collateral of sortedCollaterals) {
        const percentage = (collateral.amount / totalSupply) * 100;
        if (percentage >= 5) {
          processedCollaterals.push({ ...collateral, percentage });
        } else {
          othersAmount += collateral.amount;
        }
      }

      if (othersAmount > 0) {
        const othersPercentage = (othersAmount / totalSupply) * 100;
        processedCollaterals.push({
          address: 'others',
          symbol: 'Others',
          amount: othersAmount,
          percentage: othersPercentage,
        });
      }

      return { ...position, processedCollaterals };
    });
  }, [groupedPositions]);

  console.log('processedPositions', processedPositions);

  // Update selectedGroupedPosition when groupedPositions change, don't depend on selectedGroupedPosition
  useEffect(() => {
    if (selectedGroupedPosition) {
      const updatedPosition = processedPositions.find(
        (position) =>
          position.loanAssetAddress === selectedGroupedPosition.loanAssetAddress &&
          position.chainId === selectedGroupedPosition.chainId,
      );
      if (updatedPosition) {
        setSelectedGroupedPosition(updatedPosition);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedPositions]);

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  };

  const handleManualRefresh = () => {
    refetch(() => toast.info('Data refreshed', { icon: <span>🚀</span> }));
  };

  return (
    <div className="space-y-4 overflow-x-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Your Supply</h2>
          {isRefetching && <Spinner size="sm" />}
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefetching}
          type="button"
          className="flex items-center gap-2 rounded-md bg-gray-200 px-3 py-1 text-sm text-secondary transition-colors hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          <GrRefresh size={16} />
          Refresh
        </button>
      </div>
      <table className="responsive w-full min-w-[640px] font-zen">
        <thead className="table-header">
          <tr>
            <th className="w-10" />
            <th className="w-10">Network</th>
            <th>Size</th>
            <th>Avg APY</th>
            <th>Collateral Exposure</th>
            <th>Warnings</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody className="table-body text-sm">
          {processedPositions.map((position) => {
            const rowKey = `${position.loanAssetAddress}-${position.chainId}`;
            const isExpanded = expandedRows.has(rowKey);
            const avgApy = position.totalWeightedApy / position.totalSupply;

            return (
              <React.Fragment key={rowKey}>
                <tr className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRow(rowKey)}>
                  <td className="w-10 text-center">
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </td>
                  <td className="w-10">
                    <div className="flex items-center justify-center">
                      <Image
                        src={getNetworkImg(position.chainId) ?? ''}
                        alt={`Chain ${position.chainId}`}
                        width={24}
                        height={24}
                      />
                    </div>
                  </td>
                  <td data-label="Size">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-medium">{formatReadable(position.totalSupply)}</span>
                      <span>{position.loanAsset}</span>
                      <TokenIcon
                        address={position.loanAssetAddress}
                        chainId={position.chainId}
                        width={16}
                        height={16}
                      />
                    </div>
                  </td>
                  <td data-label="Avg APY">
                    <div className="text-center">{formatReadable(avgApy * 100)}%</div>
                  </td>
                  <td data-label="Collateral Exposure">
                    <div className="flex items-center justify-center gap-1">
                      {position.collaterals.length > 0 ? (
                        position.collaterals.map((collateral, index) => (
                          <TokenIcon
                            key={`${collateral.address}-${index}`}
                            address={collateral.address}
                            chainId={position.chainId}
                            width={20}
                            height={20}
                          />
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No known collaterals</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Warnings" className="align-middle">
                    <div className="flex items-center justify-center gap-1">
                      <MarketAssetIndicator
                        market={{ warningsWithDetail: position.allWarnings }}
                        isBatched
                      />
                      <MarketOracleIndicator
                        market={{ warningsWithDetail: position.allWarnings }}
                        isBatched
                      />
                      <MarketDebtIndicator
                        market={{ warningsWithDetail: position.allWarnings }}
                        isBatched
                      />
                    </div>
                  </td>
                  <td data-label="Actions" className="text-right">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        className="bg-hovered rounded-sm bg-opacity-50 p-2 text-xs duration-300 ease-in-out hover:bg-primary"
                        onClick={() => {
                          setSelectedGroupedPosition(position);
                          setShowRebalanceModal(true);
                        }}
                      >
                        Rebalance
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <SuppliedMarketsDetail
                        groupedPosition={position}
                        setShowSupplyModal={setShowSupplyModal}
                        setShowWithdrawModal={setShowWithdrawModal}
                        setSelectedPosition={setSelectedPosition}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {showRebalanceModal && selectedGroupedPosition && (
        <RebalanceModal
          groupedPosition={selectedGroupedPosition}
          onClose={() => setShowRebalanceModal(false)}
          isOpen={showRebalanceModal}
          refetch={refetch}
          isRefetching={isRefetching}
        />
      )}
    </div>
  );
}

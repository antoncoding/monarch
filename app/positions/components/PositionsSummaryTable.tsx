import React, { useMemo, useState, useEffect } from 'react';
import { Spinner } from '@nextui-org/react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { GrRefresh } from 'react-icons/gr';
import { toast } from 'react-toastify';
import { useAccount } from 'wagmi';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { MarketPosition, GroupedPosition } from '@/utils/types';
import { getCollateralColor } from '../utils/colors';
import { RebalanceModal } from './RebalanceModal';
import { SuppliedMarketsDetail } from './SuppliedMarketsDetail';

type PositionTableProps = {
  marketPositions: MarketPosition[];
  setShowModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
};

export function PositionsSummaryTable({
  marketPositions,
  setShowModal,
  setSelectedPosition,
  refetch,
  isRefetching,
}: PositionTableProps) {
  const { address: account } = useAccount();

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
        };
        acc.push(groupedPosition);
      }

      const supplyAmount = Number(
        formatBalance(position.supplyAssets, position.market.loanAsset.decimals),
      );
      groupedPosition.totalSupply += supplyAmount;

      const weightedApy = supplyAmount * position.market.dailyApys.netSupplyApy;
      if (!groupedPosition.totalWeightedApy) {
        groupedPosition.totalWeightedApy = 0;
      }
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

      groupedPosition.markets.push(position);
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
    refetch(() => {
      toast.info('Data refreshed', { icon: <span>🚀</span> });
    });
  };

  return (
    <div className="space-y-4 overflow-x-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Position Summary</h2>
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
            <th>Asset</th>
            <th>Total Supplied</th>
            <th>Avg APY</th>
            <th className="w-1/4">Collateral Exposure</th>
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
                  <td data-label="Asset">
                    <div className="flex items-center justify-center gap-2">
                      {findToken(position.loanAssetAddress, position.chainId)?.img && (
                        <Image
                          src={findToken(position.loanAssetAddress, position.chainId)?.img ?? ''}
                          alt={position.loanAsset}
                          width={24}
                          height={24}
                        />
                      )}
                      <span className="font-medium">{position.loanAsset}</span>
                    </div>
                  </td>
                  <td data-label="Total Supplied">
                    <div className="text-center">
                      {formatReadable(position.totalSupply)} {position.loanAsset}
                    </div>
                  </td>
                  <td data-label="Avg APY">
                    <div className="text-center">{formatReadable(avgApy * 100)}%</div>
                  </td>
                  <td data-label="Collateral Breakdown" className="w-1/4">
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
                      {position.processedCollaterals.map((collateral, colIndex) => (
                        <div
                          key={`${collateral.address}-${colIndex}`}
                          className="h-full opacity-70"
                          style={{
                            width: `${collateral.percentage}%`,
                            backgroundColor:
                              collateral.symbol === 'Others'
                                ? '#A0AEC0'
                                : getCollateralColor(collateral.address),
                          }}
                          title={`${collateral.symbol}: ${collateral.percentage.toFixed(2)}%`}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap justify-center text-xs">
                      {position.processedCollaterals.map((collateral, colIndex) => (
                        <span
                          key={`${collateral.address}-${colIndex}`}
                          className="mb-1 mr-2 opacity-70"
                        >
                          <span
                            style={{
                              color:
                                collateral.symbol === 'Others'
                                  ? '#A0AEC0'
                                  : getCollateralColor(collateral.address),
                            }}
                          >
                            ■
                          </span>{' '}
                          {collateral.symbol}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Actions" className="text-right">
                    <button
                      type="button"
                      className="bg-hovered rounded-sm p-2 text-xs duration-300 ease-in-out hover:bg-orange-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (account) {
                          setSelectedGroupedPosition(position);
                          setShowRebalanceModal(true);
                        } else {
                          toast.info('Please connect your wallet to rebalance');
                        }
                      }}
                    >
                      Rebalance
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <SuppliedMarketsDetail
                        groupedPosition={position}
                        setShowModal={setShowModal}
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

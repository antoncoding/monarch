import React, { useMemo, useState, useEffect } from 'react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@nextui-org/react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { IoRefreshOutline, IoChevronDownOutline } from 'react-icons/io5';
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

export enum EarningsPeriod {
  All = 'all',
  Day = '1D',
  Week = '7D',
  Month = '30D'
}

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
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>(EarningsPeriod.Day);

  const getEarningsForPeriod = (position: MarketPosition) => {
    if (!position.earned) return '0';

    switch (earningsPeriod) {
      case EarningsPeriod.All:
        return position.earned.lifetimeEarned;
      case EarningsPeriod.Day:
        return position.earned.last24hEarned;
      case EarningsPeriod.Week:
        return position.earned.last7dEarned;
      case EarningsPeriod.Month:
        return position.earned.last30dEarned;
      default:
        return '0';
    }
  };

  const getGroupedEarnings = (groupedPosition: GroupedPosition) => {
    return groupedPosition.markets
      .reduce((total, position) => {
        const earnings = getEarningsForPeriod(position);
        return total + BigInt(earnings);
      }, 0n)
      .toString();
  };

  const periodLabels: Record<EarningsPeriod, string> = {
    [EarningsPeriod.All]: 'All Time',
    [EarningsPeriod.Day]: '24h',
    [EarningsPeriod.Week]: '7d',
    [EarningsPeriod.Month]: '30d',
  };

  const groupedPositions: GroupedPosition[] = useMemo(() => {
    return marketPositions
      .reduce((acc: GroupedPosition[], position) => {
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
            totalPrincipal: 0n,
            totalEarned: 0n,
            totalLifetimeEarnings: 0n,
            collaterals: [],
            markets: [],
            processedCollaterals: [],
            allWarnings: [],
          };
          acc.push(groupedPosition);
        }

        groupedPosition.markets.push(position);

        if (position.principal) {
          groupedPosition.totalPrincipal += BigInt(position.principal);
        }
        if (position.earned) {
          groupedPosition.totalEarned += BigInt(position.earned.lifetimeEarned);
        }

        groupedPosition.allWarnings = [
          ...new Set([
            ...groupedPosition.allWarnings,
            ...(position.market.warningsWithDetail || []),
          ]),
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
      }, [])
      .sort((a, b) => b.totalSupply - a.totalSupply);
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

  console.log('marketPositions:', marketPositions);
  console.log('Processed positions:', groupedPositions);

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
      <div className="mb-4 flex items-center justify-end gap-2">
        <Dropdown>
          <DropdownTrigger>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-surface-dark px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-orange-500 hover:text-white"
            >
              {periodLabels[earningsPeriod]}
              <IoChevronDownOutline className="h-4 w-4" />
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Time period selection"
            onAction={(key) => setEarningsPeriod(key as EarningsPeriod)}
          >
            {Object.entries(periodLabels).map(([period, label]) => (
              <DropdownItem key={period}>{label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-surface-dark px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-orange-500 hover:text-white"
          onClick={handleManualRefresh}
        >
          <IoRefreshOutline className="h-4 w-4" />
          Refresh
        </button>
      </div>
      <div className="bg-surface overflow-hidden rounded-lg">
        <table className="responsive w-full min-w-[640px] font-zen">
          <thead className="table-header">
            <tr className="border-surface-dark border-b text-secondary">
              <th className="w-10" />
              <th className="w-10">Network</th>
              <th>Size</th>
              <th>APY (now)</th>
              <th>Interest Accrued ({earningsPeriod})</th>
              <th>Collateral</th>
              <th>Warnings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="table-body text-sm">
            {processedPositions.map((groupedPosition) => {
              const rowKey = `${groupedPosition.loanAssetAddress}-${groupedPosition.chainId}`;
              const isExpanded = expandedRows.has(rowKey);
              const avgApy = groupedPosition.totalWeightedApy / groupedPosition.totalSupply;

              return (
                <React.Fragment key={rowKey}>
                  <tr className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRow(rowKey)}>
                    <td className="w-10 text-center">
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </td>
                    <td className="w-10">
                      <div className="flex items-center justify-center">
                        <Image
                          src={getNetworkImg(groupedPosition.chainId) ?? ''}
                          alt={`Chain ${groupedPosition.chainId}`}
                          width={24}
                          height={24}
                        />
                      </div>
                    </td>
                    <td data-label="Size">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium">
                          {formatReadable(groupedPosition.totalSupply)}
                        </span>
                        <span>{groupedPosition.loanAsset}</span>
                        <TokenIcon
                          address={groupedPosition.loanAssetAddress}
                          chainId={groupedPosition.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </td>
                    <td data-label="APY (now)">
                      <div className="flex items-center justify-center">
                        <span className="font-medium">
                          {formatReadable(avgApy * 100)}%
                        </span>
                      </div>
                    </td>
                    <td data-label={`Interest Accrued (${earningsPeriod})`}>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium">
                          {formatReadable(
                            Number(
                              formatBalance(
                                getGroupedEarnings(groupedPosition),
                                groupedPosition.loanAssetDecimals,
                              ),
                            ),
                          )}
                        </span>
                        <span>{groupedPosition.loanAsset}</span>
                      </div>
                    </td>
                    <td data-label="Collateral">
                      <div className="flex items-center justify-center gap-1">
                        {groupedPosition.collaterals.length > 0 ? (
                          groupedPosition.collaterals.map((collateral, index) => (
                            <TokenIcon
                              key={`${collateral.address}-${index}`}
                              address={collateral.address}
                              chainId={groupedPosition.chainId}
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
                          market={{ warningsWithDetail: groupedPosition.allWarnings }}
                          isBatched
                        />
                        <MarketOracleIndicator
                          market={{ warningsWithDetail: groupedPosition.allWarnings }}
                          isBatched
                        />
                        <MarketDebtIndicator
                          market={{ warningsWithDetail: groupedPosition.allWarnings }}
                          isBatched
                        />
                      </div>
                    </td>
                    <td data-label="Actions" className="px-4 py-3 text-right text-primary">
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          className="bg-hovered rounded-sm bg-opacity-50 p-2 text-xs duration-300 ease-in-out hover:bg-primary"
                          onClick={() => {
                            setSelectedGroupedPosition(groupedPosition);
                            setShowRebalanceModal(true);
                          }}
                        >
                          Rebalance
                        </button>
                      </div>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedRows.has(rowKey) && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            transition={{ duration: 0.1 }}
                            className="overflow-hidden"
                          >
                            <SuppliedMarketsDetail
                              groupedPosition={groupedPosition}
                              setShowWithdrawModal={setShowWithdrawModal}
                              setShowSupplyModal={setShowSupplyModal}
                              setSelectedPosition={setSelectedPosition}
                            />
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
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

import React, { useMemo, useState, useEffect } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { IconSwitch } from '@/components/ui/icon-switch';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { ReloadIcon } from '@radix-ui/react-icons';
import { GearIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { BsQuestionCircle } from 'react-icons/bs';
import { IoChevronDownOutline } from 'react-icons/io5';
import { PiHandCoins } from 'react-icons/pi';
import { PulseLoader } from 'react-spinners';
import { useConnection } from 'wagmi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarkets } from '@/hooks/useMarkets';
import { computeMarketWarnings } from '@/hooks/useMarketWarnings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import type { EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { getGroupedEarnings, groupPositionsByLoanAsset, processCollaterals } from '@/utils/positions';
import { convertApyToApr } from '@/utils/rateMath';
import { storageKeys } from '@/utils/storageKeys';
import {
  type MarketPosition,
  type GroupedPosition,
  type MarketPositionWithEarnings,
  type WarningWithDetail,
  WarningCategory,
} from '@/utils/types';
import { RiskIndicator } from '@/features/markets/components/risk-indicator';
import { PositionActionsDropdown } from './position-actions-dropdown';
import { RebalanceModal } from './rebalance/rebalance-modal';
import { SuppliedMarketsDetail } from './supplied-markets-detail';

// Component to compute and display aggregated risk indicators for a group of positions
function AggregatedRiskIndicators({ groupedPosition }: { groupedPosition: GroupedPosition }) {
  // Compute warnings for all markets in the group
  const allWarnings: WarningWithDetail[] = [];

  for (const position of groupedPosition.markets) {
    const marketWarnings = computeMarketWarnings(position.market, true);
    allWarnings.push(...marketWarnings);
  }

  // Remove duplicates based on warning code
  const uniqueWarnings = allWarnings.filter((warning, index, array) => array.findIndex((w) => w.code === warning.code) === index);

  // Helper to get warnings by category and determine risk level
  const getWarningIndicator = (category: WarningCategory, greenDesc: string, yellowDesc: string, redDesc: string) => {
    const categoryWarnings = uniqueWarnings.filter((w) => w.category === category);

    if (categoryWarnings.length === 0) {
      return (
        <RiskIndicator
          level="green"
          description={greenDesc}
          mode="complex"
        />
      );
    }

    if (categoryWarnings.some((w) => w.level === 'alert')) {
      const alertWarning = categoryWarnings.find((w) => w.level === 'alert');
      return (
        <RiskIndicator
          level="red"
          description={`One or more markets have: ${redDesc}`}
          mode="complex"
          warningDetail={alertWarning}
        />
      );
    }

    return (
      <RiskIndicator
        level="yellow"
        description={`One or more markets have: ${yellowDesc}`}
        mode="complex"
        warningDetail={categoryWarnings[0]}
      />
    );
  };

  return (
    <>
      {getWarningIndicator(WarningCategory.asset, 'Recognized asset', 'Asset with warning', 'High-risk asset')}
      {getWarningIndicator(WarningCategory.oracle, 'Recognized oracles', 'Oracle warning', 'Oracle warning')}
      {getWarningIndicator(WarningCategory.debt, 'No bad debt', 'Bad debt has occurred', 'Bad debt higher than 1% of supply')}
    </>
  );
}

type PositionsSummaryTableProps = {
  account: string;
  marketPositions: MarketPositionWithEarnings[];
  setShowWithdrawModal: (show: boolean) => void;
  setShowSupplyModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
  isLoadingEarnings?: boolean;
  earningsPeriod: EarningsPeriod;
  setEarningsPeriod: (period: EarningsPeriod) => void;
};

export function PositionsSummaryTable({
  marketPositions,
  setShowWithdrawModal,
  setShowSupplyModal,
  setSelectedPosition,
  refetch,
  isRefetching,
  isLoadingEarnings,
  account,
  earningsPeriod,
  setEarningsPeriod,
}: PositionsSummaryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [selectedGroupedPosition, setSelectedGroupedPosition] = useState<GroupedPosition | null>(null);
  const [showCollateralExposure, setShowCollateralExposure] = useLocalStorage<boolean>(
    storageKeys.PositionsShowCollateralExposureKey,
    true,
  );
  const { address } = useConnection();
  const { isAprDisplay } = useMarkets();
  const { short: rateLabel } = useRateLabel();

  const toast = useStyledToast();

  const isOwner = useMemo(() => {
    if (!account) return false;
    return account === address;
  }, [account, address]);

  const periodLabels: Record<EarningsPeriod, string> = {
    all: 'All Time',
    day: '1D',
    week: '7D',
    month: '30D',
  };

  const groupedPositions = useMemo(() => groupPositionsByLoanAsset(marketPositions), [marketPositions]);

  const processedPositions = useMemo(() => processCollaterals(groupedPositions), [groupedPositions]);

  useEffect(() => {
    if (selectedGroupedPosition) {
      const updatedPosition = processedPositions.find(
        (position) =>
          position.loanAssetAddress === selectedGroupedPosition.loanAssetAddress && position.chainId === selectedGroupedPosition.chainId,
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
    refetch(() =>
      toast.info('Data updated', 'Position data updated', {
        icon: <span>🚀</span>,
      }),
    );
  };

  return (
    <div className="space-y-4 overflow-x-auto">
      <div className="mb-4 flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="font-zen text-secondary min-w-fit"
            >
              <IoChevronDownOutline className="mr-2 h-4 w-4" />
              {periodLabels[earningsPeriod]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.entries(periodLabels).map(([period, label]) => (
              <DropdownMenuItem
                key={period}
                onClick={() => setEarningsPeriod(period as EarningsPeriod)}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip
          content={
            <TooltipContent
              title="Refresh"
              detail="Fetch latest position data"
            />
          }
        >
          <span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefetching}
              className="text-secondary min-w-0 px-2"
            >
              <ReloadIcon className={`${isRefetching ? 'animate-spin' : ''} h-3 w-3`} />
            </Button>
          </span>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-secondary min-w-0 px-2"
            >
              <GearIcon className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              className="flex h-auto gap-2 p-0"
              onSelect={(e) => e.preventDefault()}
            >
              <div className="flex w-full items-center justify-between px-2 py-1.5">
                <span className="mr-2 text-xs">Show Collateral Exposure</span>
                <IconSwitch
                  size="xs"
                  selected={showCollateralExposure}
                  onChange={setShowCollateralExposure}
                  thumbIcon={null}
                  classNames={{
                    wrapper: 'mx-0',
                    thumbIcon: 'p-0 mr-0',
                  }}
                />
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="bg-surface overflow-hidden rounded shadow-sm">
        <Table className="responsive w-full min-w-[640px]">
          <TableHeader>
            <TableRow className="w-full justify-center text-secondary">
              <TableHead className="w-10" />
              <TableHead className="w-10">Network</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>{rateLabel} (now)</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  Interest Accrued ({earningsPeriod})
                  <Tooltip
                    className="max-w-[500px] rounded-sm"
                    content={
                      <TooltipContent
                        title="Interest Accrued"
                        detail="This amount is the sum of interest accrued from all active positions for the selected period. If you want a detailed breakdown including closed positions, go to Report"
                        icon={<PiHandCoins size={16} />}
                      />
                    }
                  >
                    <div className="cursor-help">
                      <BsQuestionCircle
                        size={14}
                        className="text-gray-400"
                      />
                    </div>
                  </Tooltip>
                </span>
              </TableHead>
              <TableHead>Collateral</TableHead>
              <TableHead>Warnings</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {processedPositions.map((groupedPosition) => {
              const rowKey = `${groupedPosition.loanAssetAddress}-${groupedPosition.chainId}`;
              const isExpanded = expandedRows.has(rowKey);
              const avgApy = groupedPosition.totalWeightedApy;

              const earnings = getGroupedEarnings(groupedPosition);

              return (
                <React.Fragment key={rowKey}>
                  <TableRow
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRow(rowKey)}
                  >
                    <TableCell className="w-10 text-center">{isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}</TableCell>
                    <TableCell className="w-10">
                      <div className="flex items-center justify-center">
                        <Image
                          src={getNetworkImg(groupedPosition.chainId) ?? ''}
                          alt={`Chain ${groupedPosition.chainId}`}
                          width={24}
                          height={24}
                        />
                      </div>
                    </TableCell>
                    <TableCell data-label="Size">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium">{formatReadable(groupedPosition.totalSupply)}</span>
                        <span>{groupedPosition.loanAsset}</span>
                        <TokenIcon
                          address={groupedPosition.loanAssetAddress}
                          chainId={groupedPosition.chainId}
                          symbol={groupedPosition.loanAssetSymbol}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell data-label={`${rateLabel} (now)`}>
                      <div className="flex items-center justify-center">
                        <span className="font-medium">{formatReadable((isAprDisplay ? convertApyToApr(avgApy) : avgApy) * 100)}%</span>
                      </div>
                    </TableCell>
                    <TableCell data-label={`Interest Accrued (${earningsPeriod})`}>
                      <div className="flex items-center justify-center gap-2">
                        {isLoadingEarnings ? (
                          <div className="flex items-center justify-center">
                            <PulseLoader
                              size={4}
                              color="#f45f2d"
                              margin={3}
                            />
                          </div>
                        ) : (
                          <span className="font-medium">
                            {(() => {
                              if (earnings === 0n) return '-';
                              return (
                                formatReadable(Number(formatBalance(earnings, groupedPosition.loanAssetDecimals))) +
                                ' ' +
                                groupedPosition.loanAsset
                              );
                            })()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-label="Collateral">
                      <div className="flex items-center justify-center gap-1">
                        {groupedPosition.collaterals.length > 0 ? (
                          groupedPosition.collaterals
                            .sort((a, b) => b.amount - a.amount)
                            .map((collateral, index) => (
                              <TokenIcon
                                key={`${collateral.address}-${index}`}
                                address={collateral.address}
                                chainId={groupedPosition.chainId}
                                symbol={collateral.symbol}
                                width={20}
                                height={20}
                                opacity={collateral.amount > 0 ? 1 : 0.5}
                              />
                            ))
                        ) : (
                          <span className="text-sm text-gray-500">No known collaterals</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      data-label="Warnings"
                      className="align-middle"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <AggregatedRiskIndicators groupedPosition={groupedPosition} />
                      </div>
                    </TableCell>
                    <TableCell
                      data-label="Actions"
                      className="justify-center px-4 py-3"
                    >
                      <div className="flex items-center justify-center">
                        <PositionActionsDropdown
                          account={account}
                          chainId={groupedPosition.chainId}
                          tokenAddress={groupedPosition.loanAssetAddress}
                          tokenSymbol={groupedPosition.loanAsset}
                          isOwner={isOwner}
                          onRebalanceClick={() => {
                            if (!isOwner) {
                              toast.error('No authorization', 'You can only rebalance your own positions');
                              return;
                            }
                            setSelectedGroupedPosition(groupedPosition);
                            setShowRebalanceModal(true);
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  <AnimatePresence>
                    {expandedRows.has(rowKey) && (
                      <TableRow className="bg-surface">
                        <TableCell
                          colSpan={10}
                          className="bg-surface"
                        >
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
                              showCollateralExposure={showCollateralExposure}
                            />
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {showRebalanceModal && selectedGroupedPosition && (
        <RebalanceModal
          groupedPosition={selectedGroupedPosition}
          onOpenChange={setShowRebalanceModal}
          isOpen={showRebalanceModal}
          refetch={refetch}
          isRefetching={isRefetching}
        />
      )}
    </div>
  );
}

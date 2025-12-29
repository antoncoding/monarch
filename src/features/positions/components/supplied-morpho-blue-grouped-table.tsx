import React, { useMemo, useState, useEffect } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Divider } from '@/components/ui/divider';
import { FilterRow, FilterSection } from '@/components/ui/filter-components';
import { ReloadIcon } from '@radix-ui/react-icons';
import { GearIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { BsQuestionCircle } from 'react-icons/bs';
import { PiHandCoins } from 'react-icons/pi';
import { PulseLoader } from 'react-spinners';
import { useConnection } from 'wagmi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { useDisclosure } from '@/hooks/useDisclosure';
import { usePositionsPreferences } from '@/stores/usePositionsPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { computeMarketWarnings } from '@/hooks/useMarketWarnings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import type { EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { getGroupedEarnings, groupPositionsByLoanAsset, processCollaterals } from '@/utils/positions';
import { convertApyToApr } from '@/utils/rateMath';
import { type GroupedPosition, type MarketPositionWithEarnings, type WarningWithDetail, WarningCategory } from '@/utils/types';
import { RiskIndicator } from '@/features/markets/components/risk-indicator';
import { PositionActionsDropdown } from './position-actions-dropdown';
import { RebalanceModal } from './rebalance/rebalance-modal';
import { SuppliedMarketsDetail } from './supplied-markets-detail';
import { CollateralIconsDisplay } from './collateral-icons-display';

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

type SuppliedMorphoBlueGroupedTableProps = {
  account: string;
  marketPositions: MarketPositionWithEarnings[];
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
  isLoadingEarnings?: boolean;
  earningsPeriod: EarningsPeriod;
  setEarningsPeriod: (period: EarningsPeriod) => void;
  chainBlockData?: Record<number, { block: number; timestamp: number }>;
  isTruncated?: boolean;
};

export function SuppliedMorphoBlueGroupedTable({
  marketPositions,
  refetch,
  isRefetching,
  isLoadingEarnings,
  account,
  earningsPeriod,
  setEarningsPeriod,
  chainBlockData,
  isTruncated,
}: SuppliedMorphoBlueGroupedTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [selectedGroupedPosition, setSelectedGroupedPosition] = useState<GroupedPosition | null>(null);
  // Positions preferences from Zustand store
  const { showCollateralExposure, setShowCollateralExposure } = usePositionsPreferences();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsOpenChange } = useDisclosure();
  const { address } = useConnection();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const toast = useStyledToast();

  const isOwner = useMemo(() => {
    if (!account) return false;
    return account === address;
  }, [account, address]);

  const periodLabels: Record<EarningsPeriod, string> = {
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

  // Header actions (refresh, settings)
  const headerActions = (
    <>
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
      <Tooltip
        content={
          <TooltipContent
            title="Settings"
            detail="Configure view settings"
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="text-secondary min-w-0 px-2"
          onClick={onSettingsOpen}
        >
          <GearIcon className="h-3 w-3" />
        </Button>
      </Tooltip>
    </>
  );

  return (
    <div className="space-y-6 overflow-x-auto">
      <TableContainerWithHeader
        title="Market Supplies"
        actions={headerActions}
      >
        <Table className="responsive w-full min-w-[640px]">
          <TableHeader>
            <TableRow className="w-full justify-center text-secondary">
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
              <TableHead>Risk Tiers</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {processedPositions.map((groupedPosition) => {
              const rowKey = `${groupedPosition.loanAssetAddress}-${groupedPosition.chainId}`;
              const _isExpanded = expandedRows.has(rowKey);
              const avgApy = groupedPosition.totalWeightedApy;

              const earnings = getGroupedEarnings(groupedPosition);

              return (
                <React.Fragment key={rowKey}>
                  <TableRow
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRow(rowKey)}
                  >
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
                        ) : isTruncated ? (
                          <Tooltip
                            content={
                              <TooltipContent
                                title="Data Incomplete"
                                detail="Transaction history exceeds 1,000 entries. Use Position Report for accurate earnings calculation."
                              />
                            }
                          >
                            <span className="font-medium cursor-help">-</span>
                          </Tooltip>
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
                      <CollateralIconsDisplay
                        collaterals={groupedPosition.collaterals}
                        chainId={groupedPosition.chainId}
                        maxDisplay={8}
                        iconSize={20}
                      />
                    </TableCell>
                    <TableCell
                      data-label="Risk Tiers"
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
                      <TableRow className="bg-surface [&:hover]:border-transparent [&:hover]:bg-surface">
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
      </TableContainerWithHeader>
      {showRebalanceModal && selectedGroupedPosition && (
        <RebalanceModal
          groupedPosition={selectedGroupedPosition}
          onOpenChange={setShowRebalanceModal}
          isOpen={showRebalanceModal}
          refetch={refetch}
          isRefetching={isRefetching}
        />
      )}
      <Modal
        isOpen={isSettingsOpen}
        onOpenChange={onSettingsOpenChange}
        size="md"
        backdrop="opaque"
        zIndex="settings"
      >
        {(close) => (
          <>
            <ModalHeader
              variant="compact"
              title="View Settings"
              description="Configure how morpho blue lending positions are displayed"
              mainIcon={<GearIcon />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="flex flex-col gap-4"
            >
              <FilterSection
                title="Time Period"
                helper="Select the time period for interest accrued calculations"
              >
                <div className="flex flex-col gap-2">
                  {Object.entries(periodLabels).map(([period, label]) => (
                    <label
                      key={period}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-gray-50"
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <input
                        type="radio"
                        name="earningsPeriod"
                        checked={earningsPeriod === period}
                        onChange={() => setEarningsPeriod(period as EarningsPeriod)}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </FilterSection>

              <Divider />

              <FilterSection
                title="Display Options"
                helper="Customize what information is shown in the table"
              >
                <FilterRow
                  title="Show Collateral Exposure"
                  description="Display detailed collateral breakdown for each position"
                >
                  <IconSwitch
                    selected={showCollateralExposure}
                    onChange={setShowCollateralExposure}
                    size="xs"
                  />
                </FilterRow>
              </FilterSection>
            </ModalBody>
            <ModalFooter className="justify-end">
              <Button
                color="primary"
                size="sm"
                onClick={close}
              >
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}

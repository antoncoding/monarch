import { Fragment, useMemo, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Divider } from '@/components/ui/divider';
import { FilterRow, FilterSection } from '@/components/ui/filter-components';
import { GearIcon } from '@radix-ui/react-icons';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import moment from 'moment';
import { PulseLoader } from 'react-spinners';
import { useRouter } from 'next/navigation';
import { useConnection } from 'wagmi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { useDisclosure } from '@/hooks/useDisclosure';
import { usePositionsPreferences } from '@/stores/usePositionsPreferences';
import { usePositionsFilters } from '@/stores/usePositionsFilters';
import { useAppSettings } from '@/stores/useAppSettings';
import { useModalStore } from '@/stores/useModalStore';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import useUserPositionsSummaryData, { type EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { getGroupedEarnings, groupPositionsByLoanAsset, processCollaterals } from '@/utils/positions';
import { convertApyToApr } from '@/utils/rateMath';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { getTokenPriceKey } from '@/data-sources/morpho-api/prices';
import { PositionActionsDropdown } from './position-actions-dropdown';
import { SuppliedMarketsDetail } from './supplied-markets-detail';
import { CollateralIconsDisplay } from './collateral-icons-display';
import { RiArrowRightLine } from 'react-icons/ri';

type SuppliedMorphoBlueGroupedTableProps = {
  account: string;
};

export function SuppliedMorphoBlueGroupedTable({ account }: SuppliedMorphoBlueGroupedTableProps) {
  const period = usePositionsFilters((s) => s.period);
  const setPeriod = usePositionsFilters((s) => s.setPeriod);

  const {
    positions: marketPositions,
    refetch,
    isRefetching,
    isEarningsLoading,
    actualBlockData,
    transactions,
    snapshotsByChain,
  } = useUserPositionsSummaryData(account, period);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { showEarningsInUsd, setShowEarningsInUsd } = usePositionsPreferences();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsOpenChange } = useDisclosure();
  const { address } = useConnection();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const { open: openModal } = useModalStore();
  const router = useRouter();

  const toast = useStyledToast();

  const isOwner = useMemo(() => {
    if (!account) return false;
    return account === address;
  }, [account, address]);

  const periodLabels = {
    day: '1D',
    week: '7D',
    month: '30D',
  } as const;

  const groupedPositions = useMemo(() => groupPositionsByLoanAsset(marketPositions), [marketPositions]);

  const processedPositions = useMemo(() => processCollaterals(groupedPositions), [groupedPositions]);

  const tokens = useMemo(() => {
    return processedPositions.map((p) => ({
      address: p.loanAssetAddress,
      chainId: p.chainId,
    }));
  }, [processedPositions]);

  const { prices } = useTokenPrices(tokens);

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
            <RefetchIcon isLoading={isRefetching} />
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
                {rateLabel} ({periodLabels[period]})
              </TableHead>
              <TableHead>Interest Accrued ({periodLabels[period]})</TableHead>
              <TableHead>Collateral</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {processedPositions.map((groupedPosition) => {
              const rowKey = `${groupedPosition.loanAssetAddress}-${groupedPosition.chainId}`;
              const avgApy = groupedPosition.totalWeightedApy;

              const earnings = getGroupedEarnings(groupedPosition);

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRow(rowKey)}
                  >
                    {/* Chain image */}
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

                    {/* Loan asset details */}
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

                    {/* Current APR/APY  */}
                    <TableCell data-label={`${rateLabel} (now)`}>
                      <div className="flex items-center justify-center">
                        <span className="font-medium">{formatReadable((isAprDisplay ? convertApyToApr(avgApy) : avgApy) * 100)}%</span>
                      </div>
                    </TableCell>

                    {/* Actual APY for period */}
                    <TableCell data-label={`${rateLabel} (${periodLabels[period]})`}>
                      <div className="flex items-center justify-center">
                        {isEarningsLoading ? (
                          <PulseLoader
                            size={4}
                            color="#f45f2d"
                            margin={3}
                          />
                        ) : (
                          <Tooltip
                            content={
                              <TooltipContent
                                title={`Historical ${rateLabel}`}
                                detail={`Annualized yield from interest earned over the last ${periodLabels[period]}, weighted by your balance over time.`}
                              />
                            }
                          >
                            <span className="cursor-help font-medium">
                              {formatReadable(
                                (isAprDisplay ? convertApyToApr(groupedPosition.actualApy) : groupedPosition.actualApy) * 100,
                              )}
                              %
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>

                    {/* Accrued interest */}
                    <TableCell data-label={`Interest Accrued (${period})`}>
                      <div className="flex items-center justify-center gap-2">
                        {isEarningsLoading ? (
                          <div className="flex items-center justify-center">
                            <PulseLoader
                              size={4}
                              color="#f45f2d"
                              margin={3}
                            />
                          </div>
                        ) : earnings === 0n ? (
                          <span className="font-medium">-</span>
                        ) : (
                          <Tooltip
                            content={(() => {
                              const blockData = actualBlockData[groupedPosition.chainId];
                              if (!blockData) return 'Loading timestamp data...';

                              const startTimestamp = blockData.timestamp * 1000;
                              const endTimestamp = Date.now();

                              return (
                                <TooltipContent
                                  title="Interest Accrued Time Period"
                                  detail={`Calculated from ${moment(Number(startTimestamp)).format('MMM D, YYYY HH:mm')} to ${moment(Number(endTimestamp)).format('MMM D, YYYY HH:mm')}`}
                                />
                              );
                            })()}
                          >
                            <div className="cursor-help">
                              {(() => {
                                const earningsReadable = Number(formatBalance(earnings, groupedPosition.loanAssetDecimals));
                                const priceKey = getTokenPriceKey(groupedPosition.loanAssetAddress, groupedPosition.chainId);
                                const price = prices.get(priceKey);
                                const tokenAmount = `${formatReadable(earningsReadable)} ${groupedPosition.loanAsset}`;
                                const usdValue = price ? earningsReadable * price : null;

                                if (showEarningsInUsd && usdValue !== null) {
                                  return (
                                    <div className="flex flex-col items-center gap-0 font-medium">
                                      <span>${formatReadable(usdValue, usdValue < 1 ? 4 : 2)}</span>
                                      <span className="font-normal opacity-70">{tokenAmount}</span>
                                    </div>
                                  );
                                }
                                return <div className="flex justify-center font-medium">{tokenAmount}</div>;
                              })()}
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>

                    {/* Collateral exposure */}
                    <TableCell data-label="Collateral">
                      <CollateralIconsDisplay
                        collaterals={groupedPosition.collaterals}
                        chainId={groupedPosition.chainId}
                        maxDisplay={8}
                        iconSize={20}
                      />
                    </TableCell>

                    {/* Actions button */}
                    <TableCell
                      data-label="Actions"
                      className="justify-center px-4 py-3"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <PositionActionsDropdown
                          isOwner={isOwner}
                          onRebalanceClick={() => {
                            if (!isOwner) {
                              toast.error('No authorization', 'You can only rebalance your own positions');
                              return;
                            }
                            openModal('rebalance', {
                              groupedPosition,
                              refetch,
                              isRefetching,
                            });
                          }}
                        />
                        <Tooltip
                          content={
                            <TooltipContent
                              title="View Details"
                              detail="Go one level deeper"
                            />
                          }
                        >
                          <Button
                            size="xs"
                            variant="surface"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/position/${groupedPosition.chainId}/${groupedPosition.loanAssetAddress}/${account}`);
                            }}
                            aria-label="View position details"
                          >
                            <RiArrowRightLine className="h-3.5 w-3.5" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                  <AnimatePresence>
                    {expandedRows.has(rowKey) && (
                      <TableRow className="bg-surface [&:hover]:border-transparent [&:hover]:bg-surface">
                        <TableCell
                          colSpan={7}
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
                              transactions={transactions}
                              snapshotsByChain={snapshotsByChain}
                              chainBlockData={actualBlockData}
                            />
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainerWithHeader>
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
                  {Object.entries(periodLabels).map(([periodKey, label]) => (
                    <label
                      key={periodKey}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-gray-50"
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <input
                        type="radio"
                        name="earningsPeriod"
                        checked={period === periodKey}
                        onChange={() => setPeriod(periodKey as EarningsPeriod)}
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
                  title="Show Earnings in USD"
                  description="Display accrued interest in USD alongside token amount"
                >
                  <IconSwitch
                    selected={showEarningsInUsd}
                    onChange={setShowEarningsInUsd}
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

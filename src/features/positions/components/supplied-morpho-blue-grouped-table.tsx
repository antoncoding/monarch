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
import { Badge } from '@/components/ui/badge';
import { TokenIcon } from '@/components/shared/token-icon';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { useDisclosure } from '@/hooks/useDisclosure';
import { CURRENT_POSITIONS_SETTINGS_VERSION, usePositionsPreferences } from '@/stores/usePositionsPreferences';
import { usePositionsFilters } from '@/stores/usePositionsFilters';
import { useAppSettings } from '@/stores/useAppSettings';
import { useModalStore } from '@/stores/useModalStore';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import type { EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import { formatReadable, formatReadableTokenAmount } from '@/utils/balance';
import { computeAssetUsdValue, formatUsdValueDisplay } from '@/utils/assetDisplay';
import { formatTokenAmountPreview } from '@/utils/token-amount-format';
import { getNetworkImg } from '@/utils/networks';
import {
  getGroupedEarnings,
  groupPositionsByLoanAsset,
  hasActiveSupplyPosition,
  hasSupplyPositionHistory,
  processCollaterals,
} from '@/utils/positions';
import { convertApyToApr } from '@/utils/rateMath';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { getTokenPriceKey } from '@/data-sources/morpho-api/prices';
import { APYCell } from '@/features/markets/components/apy-breakdown-tooltip';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketRiskIndicators } from '@/features/markets/components/market-risk-indicators';
import { PositionActionsDropdown } from './position-actions-dropdown';
import { SuppliedMarketPositionActionsDropdown } from './supplied-market-position-actions-dropdown';
import { SuppliedMarketsDetail } from './supplied-markets-detail';
import { CollateralIconsDisplay } from './collateral-icons-display';
import { RiArrowRightLine, RiSparklingFill } from 'react-icons/ri';
import type { MarketPositionWithEarnings, UserTransaction } from '@/utils/types';
import type { PositionSnapshot } from '@/utils/positions';

type SuppliedMorphoBlueGroupedTableProps = {
  account: string;
  positions: MarketPositionWithEarnings[];
  refetch: (onSuccess?: () => void) => Promise<void>;
  isRefetching: boolean;
  isEarningsLoading: boolean;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
};

type SuppliedMarketPositionsTableProps = {
  positions: MarketPositionWithEarnings[];
  periodLabel: string;
  rateLabel: string;
  hideEmptyPositions: boolean;
  isEarningsLoading: boolean;
  isOwner: boolean;
  showEarningsInUsd: boolean;
  isAprDisplay: boolean;
  prices: Map<string, number>;
  refetch: (onSuccess?: () => void) => Promise<void>;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
};

type InterestAccruedDisplayProps = {
  earnings: bigint;
  assetDecimals: number;
  assetSymbol: string;
  assetAddress: string;
  chainId: number;
  isEarningsLoading: boolean;
  showEarningsInUsd: boolean;
  prices: Map<string, number>;
  blockData?: { block: number; timestamp: number };
};

function InterestAccruedDisplay({
  earnings,
  assetDecimals,
  assetSymbol,
  assetAddress,
  chainId,
  isEarningsLoading,
  showEarningsInUsd,
  prices,
  blockData,
}: InterestAccruedDisplayProps) {
  if (isEarningsLoading) {
    return (
      <div className="flex items-center justify-center">
        <PulseLoader
          size={4}
          color="#f45f2d"
          margin={3}
        />
      </div>
    );
  }

  if (earnings === 0n) {
    return <span className="font-medium">-</span>;
  }

  const earningsPreview = formatTokenAmountPreview(earnings, assetDecimals);
  const tokenAmount = `${earningsPreview.compact} ${assetSymbol}`;

  return (
    <Tooltip
      content={(() => {
        if (!blockData) return 'Loading timestamp data...';

        const startTimestamp = blockData.timestamp * 1000;
        const endTimestamp = Date.now();
        const exactTokenAmount = `${earningsPreview.full} ${assetSymbol}`;

        return (
          <TooltipContent
            title="Interest Accrued Time Period"
            detail={
              <div className="space-y-1">
                <div>
                  Calculated from {moment(Number(startTimestamp)).format('MMM D, YYYY HH:mm')} to{' '}
                  {moment(Number(endTimestamp)).format('MMM D, YYYY HH:mm')}
                </div>
                <div>Exact amount: {exactTokenAmount}</div>
              </div>
            }
          />
        );
      })()}
    >
      <div className="cursor-help">
        {(() => {
          const priceKey = getTokenPriceKey(assetAddress, chainId);
          const price = prices.get(priceKey);
          const usdValue = computeAssetUsdValue(earnings, assetDecimals, price ?? null);
          const usdDisplay = usdValue == null ? null : formatUsdValueDisplay(usdValue);

          if (showEarningsInUsd && usdDisplay !== null) {
            return (
              <div className="flex flex-col items-center gap-0 font-medium">
                <span>{usdDisplay.display}</span>
                <span className="font-normal opacity-70">{tokenAmount}</span>
              </div>
            );
          }

          return <div className="flex justify-center font-medium">{tokenAmount}</div>;
        })()}
      </div>
    </Tooltip>
  );
}

function NewSettingBadge() {
  return (
    <Badge
      variant="default"
      className="gap-1 bg-yellow-500/15 px-1.5 py-0.5 text-[10px] text-yellow-600 dark:text-yellow-400"
    >
      <RiSparklingFill className="h-3 w-3" />
      New
    </Badge>
  );
}

function SuppliedMarketPositionsTable({
  positions,
  periodLabel,
  rateLabel,
  hideEmptyPositions,
  isEarningsLoading,
  isOwner,
  showEarningsInUsd,
  isAprDisplay,
  prices,
  refetch,
  actualBlockData,
}: SuppliedMarketPositionsTableProps) {
  return (
    <Table className="responsive w-full min-w-[960px] table-fixed">
      <TableHeader>
        <TableRow className="w-full justify-center text-secondary">
          <TableHead className="w-16">Network</TableHead>
          <TableHead className="w-[30%]">Market</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>{rateLabel} (now)</TableHead>
          <TableHead>
            {rateLabel} ({periodLabel})
          </TableHead>
          <TableHead>Interest Accrued ({periodLabel})</TableHead>
          <TableHead>Risk Tiers</TableHead>
          <TableHead className="w-20">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="text-sm">
        {positions.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={8}
              className="py-8 text-center text-secondary"
            >
              {hideEmptyPositions ? 'Empty supply positions are hidden.' : 'You have no supply positions.'}
            </TableCell>
          </TableRow>
        )}
        {positions.map((position) => {
          const chainId = position.market.morphoBlue.chain.id;
          const rowKey = `${position.market.uniqueKey}-${chainId}`;
          const hasActiveSupply = hasActiveSupplyPosition(position);
          const suppliedAmount = Number(position.state.supplyAssets) / 10 ** position.market.loanAsset.decimals;
          const earned = BigInt(position.earned ?? '0');

          return (
            <TableRow
              key={rowKey}
              className="hover:bg-gray-50"
            >
              <TableCell className="w-16">
                <div className="flex items-center justify-center">
                  <NetworkIcon
                    networkId={chainId}
                    size={20}
                  />
                </div>
              </TableCell>

              <TableCell data-label="Market">
                <MarketIdentity
                  market={position.market}
                  mode={MarketIdentityMode.Focused}
                  focus={MarketIdentityFocus.Collateral}
                  chainId={chainId}
                  showId
                  showOracle
                  showLltv
                />
              </TableCell>

              <TableCell data-label="Size">
                <div className="flex items-center justify-center gap-2">
                  <span className={`font-medium ${hasActiveSupply ? '' : 'text-secondary'}`}>
                    {formatReadableTokenAmount(suppliedAmount)}
                  </span>
                  <span>{position.market.loanAsset.symbol}</span>
                  <TokenIcon
                    address={position.market.loanAsset.address}
                    chainId={chainId}
                    symbol={position.market.loanAsset.symbol}
                    width={16}
                    height={16}
                  />
                </div>
              </TableCell>

              <TableCell data-label={`${rateLabel} (now)`}>
                <div className="flex items-center justify-center font-medium">
                  <APYCell market={position.market} />
                </div>
              </TableCell>

              <TableCell data-label={`${rateLabel} (${periodLabel})`}>
                <div className="flex items-center justify-center">
                  {isEarningsLoading ? (
                    <PulseLoader
                      size={4}
                      color="#f45f2d"
                      margin={3}
                    />
                  ) : position.actualApy === 0 ? (
                    <span className="font-medium text-secondary">-</span>
                  ) : (
                    <Tooltip
                      content={
                        <TooltipContent
                          title={`Historical ${rateLabel}`}
                          detail={`Annualized yield from this market position over the last ${periodLabel}.`}
                        />
                      }
                    >
                      <span className="cursor-help font-medium">
                        {formatReadable((isAprDisplay ? convertApyToApr(position.actualApy) : position.actualApy) * 100)}%
                      </span>
                    </Tooltip>
                  )}
                </div>
              </TableCell>

              <TableCell data-label={`Interest Accrued (${periodLabel})`}>
                <div className="flex items-center justify-center gap-2">
                  <InterestAccruedDisplay
                    earnings={earned}
                    assetDecimals={position.market.loanAsset.decimals}
                    assetSymbol={position.market.loanAsset.symbol}
                    assetAddress={position.market.loanAsset.address}
                    chainId={chainId}
                    isEarningsLoading={isEarningsLoading}
                    showEarningsInUsd={showEarningsInUsd}
                    prices={prices}
                    blockData={actualBlockData[chainId]}
                  />
                </div>
              </TableCell>

              <TableCell
                data-label="Risk Tiers"
                className="text-center align-middle"
              >
                <MarketRiskIndicators
                  market={position.market}
                  mode="complex"
                />
              </TableCell>

              <TableCell
                data-label="Actions"
                className="justify-center px-4 py-3"
              >
                <div className="flex items-center justify-center">
                  <SuppliedMarketPositionActionsDropdown
                    position={position}
                    isOwner={isOwner}
                    isActiveSupply={hasActiveSupply}
                    refetch={refetch}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function SuppliedMorphoBlueGroupedTable({
  account,
  positions,
  refetch,
  isRefetching,
  isEarningsLoading,
  actualBlockData,
  transactions,
  snapshotsByChain,
}: SuppliedMorphoBlueGroupedTableProps) {
  const { address } = useConnection();
  const period = usePositionsFilters((s) => s.period);
  const setPeriod = usePositionsFilters((s) => s.setPeriod);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const {
    showEarningsInUsd,
    setShowEarningsInUsd,
    hideClosedPositions,
    setHideClosedPositions,
    suppliedPositionsViewMode,
    setSuppliedPositionsViewMode,
    positionsSettingsSeenVersion,
    markPositionsSettingsSeen,
  } = usePositionsPreferences();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsOpenChange } = useDisclosure();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const { open: openModal } = useModalStore();
  const router = useRouter();

  const toast = useStyledToast();

  const periodLabels: Record<EarningsPeriod, string> = {
    day: '1D',
    week: '7D',
    month: '30D',
    threemonth: '3M',
    sixmonth: '6M',
    all: 'All',
  };
  const selectedPeriodLabel = periodLabels[period] ?? period;

  const supplyPositions = useMemo(() => positions.filter(hasSupplyPositionHistory), [positions]);
  const visiblePositions = useMemo(
    () => (hideClosedPositions ? supplyPositions.filter(hasActiveSupplyPosition) : supplyPositions),
    [supplyPositions, hideClosedPositions],
  );
  const groupedPositions = useMemo(() => groupPositionsByLoanAsset(visiblePositions, actualBlockData), [visiblePositions, actualBlockData]);
  const isOwner = useMemo(() => !!account && !!address && account.toLowerCase() === address.toLowerCase(), [account, address]);

  const processedPositions = useMemo(() => processCollaterals(groupedPositions), [groupedPositions]);
  const marketPositions = useMemo(
    () =>
      [...visiblePositions].sort((a, b) => {
        const aActive = hasActiveSupplyPosition(a);
        const bActive = hasActiveSupplyPosition(b);
        if (aActive !== bActive) {
          return bActive ? 1 : -1;
        }

        const aSupply = Number(a.state.supplyAssets) / 10 ** a.market.loanAsset.decimals;
        const bSupply = Number(b.state.supplyAssets) / 10 ** b.market.loanAsset.decimals;
        if (aSupply !== bSupply) {
          return bSupply - aSupply;
        }

        return (b.market.state.supplyApy ?? 0) - (a.market.state.supplyApy ?? 0);
      }),
    [visiblePositions],
  );

  const tokens = useMemo(() => {
    const tokenMap = new Map<string, { address: string; chainId: number }>();

    for (const position of visiblePositions) {
      const loanAssetAddress = position.market.loanAsset.address;
      const chainId = position.market.morphoBlue.chain.id;
      tokenMap.set(`${chainId}-${loanAssetAddress.toLowerCase()}`, { address: loanAssetAddress, chainId });
    }

    return Array.from(tokenMap.values());
  }, [visiblePositions]);

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

  const handleSettingsOpen = () => {
    onSettingsOpen();
  };

  const hasNewSettings = positionsSettingsSeenVersion < CURRENT_POSITIONS_SETTINGS_VERSION;

  const handleSettingsOpenChange = (open: boolean) => {
    if (!open && hasNewSettings) {
      markPositionsSettingsSeen();
    }
    onSettingsOpenChange(open);
  };

  const handleGroupPositionsChange = (groupPositions: boolean) => {
    setSuppliedPositionsViewMode(groupPositions ? 'grouped' : 'market');
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
          className="relative text-secondary min-w-0 px-2"
          onClick={handleSettingsOpen}
          aria-label={hasNewSettings ? 'Settings with new options' : 'Settings'}
        >
          <GearIcon className="h-3 w-3" />
          {hasNewSettings && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--palette-orange)] ring-2 ring-[var(--color-background-secondary)]"
            />
          )}
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
        {suppliedPositionsViewMode === 'grouped' ? (
          <Table className="responsive w-full min-w-[640px]">
            <TableHeader>
              <TableRow className="w-full justify-center text-secondary">
                <TableHead className="w-10">Network</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>{rateLabel} (now)</TableHead>
                <TableHead>
                  {rateLabel} ({selectedPeriodLabel})
                </TableHead>
                <TableHead>Interest Accrued ({selectedPeriodLabel})</TableHead>
                <TableHead>Collateral</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {processedPositions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-secondary"
                  >
                    {hideClosedPositions ? 'Empty supply positions are hidden.' : 'You have no supply positions.'}
                  </TableCell>
                </TableRow>
              )}
              {processedPositions.map((groupedPosition) => {
                const rowKey = `${groupedPosition.loanAssetAddress}-${groupedPosition.chainId}`;
                const avgApy = groupedPosition.totalWeightedApy;
                const isClosedSupplyGroup = groupedPosition.totalSupply === 0;

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
                            width={20}
                            height={20}
                          />
                        </div>
                      </TableCell>

                      {/* Loan asset details */}
                      <TableCell data-label="Size">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`font-medium ${isClosedSupplyGroup ? 'text-secondary' : ''}`}>
                            {formatReadableTokenAmount(groupedPosition.totalSupply)}
                          </span>
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
                          {isClosedSupplyGroup ? (
                            <span className="font-medium text-secondary">-</span>
                          ) : (
                            <span className="font-medium">{formatReadable((isAprDisplay ? convertApyToApr(avgApy) : avgApy) * 100)}%</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Actual APY for period */}
                      <TableCell data-label={`${rateLabel} (${selectedPeriodLabel})`}>
                        <div className="flex items-center justify-center">
                          {isClosedSupplyGroup ? (
                            <span className="font-medium text-secondary">-</span>
                          ) : isEarningsLoading ? (
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
                                  detail={`Annualized yield from interest earned over the last ${selectedPeriodLabel}, weighted by your balance over time.`}
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
                      <TableCell data-label={`Interest Accrued (${selectedPeriodLabel})`}>
                        <div className="flex items-center justify-center gap-2">
                          <InterestAccruedDisplay
                            earnings={earnings}
                            assetDecimals={groupedPosition.loanAssetDecimals}
                            assetSymbol={groupedPosition.loanAsset}
                            assetAddress={groupedPosition.loanAssetAddress}
                            chainId={groupedPosition.chainId}
                            isEarningsLoading={isEarningsLoading}
                            showEarningsInUsd={showEarningsInUsd}
                            prices={prices}
                            blockData={actualBlockData[groupedPosition.chainId]}
                          />
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
                              if (!isOwner) return;
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
                                isEarningsLoading={isEarningsLoading}
                                isOwner={isOwner}
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
        ) : (
          <SuppliedMarketPositionsTable
            positions={marketPositions}
            periodLabel={selectedPeriodLabel}
            rateLabel={rateLabel}
            hideEmptyPositions={hideClosedPositions}
            isEarningsLoading={isEarningsLoading}
            isOwner={isOwner}
            showEarningsInUsd={showEarningsInUsd}
            isAprDisplay={isAprDisplay}
            prices={prices}
            refetch={refetch}
            actualBlockData={actualBlockData}
          />
        )}
      </TableContainerWithHeader>
      <Modal
        isOpen={isSettingsOpen}
        onOpenChange={handleSettingsOpenChange}
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
                title="Display Options"
                helper="Customize what information is shown in the table"
              >
                <FilterRow
                  title={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      Group Positions
                      {hasNewSettings && <NewSettingBadge />}
                    </span>
                  }
                  description="Group supplies by loan asset; turn off to list each market separately"
                >
                  <IconSwitch
                    selected={suppliedPositionsViewMode === 'grouped'}
                    onChange={handleGroupPositionsChange}
                    size="xs"
                  />
                </FilterRow>
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
                <FilterRow
                  title={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      Hide Empty Positions
                      {hasNewSettings && <NewSettingBadge />}
                    </span>
                  }
                  description="Hide exited or emptied market positions from the supply list"
                >
                  <IconSwitch
                    selected={hideClosedPositions}
                    onChange={setHideClosedPositions}
                    size="xs"
                  />
                </FilterRow>
              </FilterSection>

              <Divider />

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

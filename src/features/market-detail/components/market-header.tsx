'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { GrStatusGood } from 'react-icons/gr';
import { IoWarningOutline, IoEllipsisVertical } from 'react-icons/io5';
import { MdError } from 'react-icons/md';
import { BsArrowUpCircle, BsArrowDownLeftCircle } from 'react-icons/bs';
import { FiExternalLink } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { AddressIdentity } from '@/components/shared/address-identity';
import { CampaignBadge } from '@/features/market-detail/components/campaign-badge';
import { PositionPill } from '@/features/market-detail/components/position-pill';
import { OracleTypeInfo } from '@/features/markets/components/oracle/MarketOracle/OracleTypeInfo';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useAppSettings } from '@/stores/useAppSettings';
import { convertApyToApr } from '@/utils/rateMath';
import { getIRMTitle } from '@/utils/morpho';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { getMarketURL } from '@/utils/external';
import type { Market, MarketPosition, WarningWithDetail } from '@/utils/types';
import { WarningCategory } from '@/utils/types';
import { getRiskLevel, countWarningsByLevel, type RiskLevel } from '@/utils/warnings';

// Reusable component for rendering a block of warnings with consistent styling
type WarningBlockProps = {
  warnings: WarningWithDetail[];
  riskLevel: RiskLevel;
};

function WarningBlock({ warnings, riskLevel }: WarningBlockProps): React.ReactNode {
  if (warnings.length === 0) return null;

  const isAlert = riskLevel === 'red';
  const containerClass = isAlert
    ? 'border-red-200 bg-red-50 dark:border-red-400/20 dark:bg-red-400/10'
    : 'border-yellow-200 bg-yellow-50 dark:border-yellow-400/20 dark:bg-yellow-400/10';

  return (
    <div className={`rounded border p-3 ${containerClass}`}>
      <div className="flex items-start gap-2">
        {isAlert ? (
          <MdError className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-300" />
        ) : (
          <IoWarningOutline className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-300" />
        )}
        <div className="space-y-1">
          {warnings.map((w) => (
            <p
              key={w.code}
              className={`text-sm ${w.level === 'alert' ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}
            >
              {w.description}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// Reusable badge component for warning/alert counts
type StatusBadgeProps = {
  variant: 'success' | 'warning' | 'alert';
  count?: number;
  label: string;
};

function StatusBadge({ variant, count, label }: StatusBadgeProps): React.ReactNode {
  const styles = {
    success: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300',
    alert: 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300',
  };

  const icons = {
    success: <GrStatusGood className="h-3 w-3" />,
    warning: <IoWarningOutline className="h-3 w-3" />,
    alert: <MdError className="h-3 w-3" />,
  };

  const displayLabel = count !== undefined ? `${count} ${label}${count > 1 ? 's' : ''}` : label;

  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs ${styles[variant]}`}>
      {icons[variant]}
      {displayLabel}
    </span>
  );
}

// Risk indicator icon component
function RiskIcon({ level }: { level: RiskLevel }): React.ReactNode {
  switch (level) {
    case 'green':
      return <GrStatusGood className="h-3.5 w-3.5 text-green-600 dark:text-green-300" />;
    case 'yellow':
      return <IoWarningOutline className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-300" />;
    case 'red':
      return <MdError className="h-3.5 w-3.5 text-red-600 dark:text-red-300" />;
    default:
      return null;
  }
}

type MarketHeaderProps = {
  market: Market;
  marketId: string;
  network: SupportedNetworks;
  userPosition: MarketPosition | null;
  oraclePrice: string;
  allWarnings: WarningWithDetail[];
  onSupplyClick: () => void;
  onBorrowClick: () => void;
};

export function MarketHeader({
  market,
  marketId,
  network,
  userPosition,
  oraclePrice,
  allWarnings,
  onSupplyClick,
  onBorrowClick,
}: MarketHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { short: rateLabel } = useRateLabel();
  const { isAprDisplay } = useAppSettings();
  const networkImg = getNetworkImg(network);

  const formatRate = (rate: number) => {
    const displayRate = isAprDisplay ? convertApyToApr(rate) : rate;
    return `${(displayRate * 100).toFixed(2)}%`;
  };

  const formattedLltv = `${formatUnits(BigInt(market.lltv), 16)}%`;

  const campaignBadgeProps = {
    marketId,
    loanTokenAddress: market.loanAsset.address,
    chainId: market.morphoBlue.chain.id,
    whitelisted: market.whitelisted,
  };

  // Filter warnings by category
  const assetWarnings = allWarnings.filter((w) => w.category === WarningCategory.asset);
  const oracleWarnings = allWarnings.filter((w) => w.category === WarningCategory.oracle);
  const globalWarnings = allWarnings.filter((w) => w.category === WarningCategory.debt || w.category === WarningCategory.general);

  // Compute risk levels for each category
  const assetRiskLevel = getRiskLevel(assetWarnings);
  const oracleRiskLevel = getRiskLevel(oracleWarnings);
  const globalRiskLevel = getRiskLevel(globalWarnings);
  const { alertCount, warningCount } = countWarningsByLevel(allWarnings);

  // Render summary badges based on warning counts
  const renderSummaryBadges = (): React.ReactNode => {
    if (allWarnings.length === 0) {
      return (
        <StatusBadge
          variant="success"
          label="All Checks Passed"
        />
      );
    }

    if (alertCount > 0 && warningCount > 0) {
      return (
        <span className="inline-flex items-center gap-2 text-xs">
          <StatusBadge
            variant="warning"
            count={warningCount}
            label="Warning"
          />
          <StatusBadge
            variant="alert"
            count={alertCount}
            label="Alert"
          />
        </span>
      );
    }

    if (alertCount > 0) {
      return (
        <StatusBadge
          variant="alert"
          count={alertCount}
          label="Alert"
        />
      );
    }

    return (
      <StatusBadge
        variant="warning"
        count={warningCount}
        label="Warning"
      />
    );
  };

  return (
    <div className="mt-6 mb-6 space-y-4">
      {/* Main Header */}
      <div className="rounded border border-border bg-surface px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* LEFT: Market Identity */}
          <div className="flex items-center gap-4">
            {/* Overlapping token icons */}
            <div className="flex -space-x-3">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={40}
                height={40}
              />
              <div className="rounded-full bg-surface">
                <TokenIcon
                  address={market.collateralAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.collateralAsset.symbol}
                  width={40}
                  height={40}
                />
              </div>
            </div>

            <div>
              <div className="text-2xl pt-4">
                {market.loanAsset.symbol}/{market.collateralAsset.symbol}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
                {networkImg && (
                  <div className="flex items-center gap-1">
                    <Image
                      src={networkImg}
                      alt={network.toString()}
                      width={14}
                      height={14}
                    />
                    <span>{getNetworkName(network)}</span>
                  </div>
                )}
                <span className="text-border">·</span>
                <span>LLTV {formattedLltv}</span>
                <span className="text-border">·</span>
                <span>{getIRMTitle(market.irmAddress)}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Stats + Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Key Stats - Hidden on small screens */}
            <div className="hidden lg:flex items-center gap-6 border-r border-border pr-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Supply {rateLabel}</p>
                <div className="flex items-center gap-2">
                  <p className="tabular-nums text-lg">{formatRate(market.state.supplyApy)}</p>
                  <CampaignBadge
                    {...campaignBadgeProps}
                    filterType="supply"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Borrow {rateLabel}</p>
                <div className="flex items-center gap-2">
                  <p className="tabular-nums text-lg">{formatRate(market.state.borrowApy)}</p>
                  <CampaignBadge
                    {...campaignBadgeProps}
                    filterType="borrow"
                  />
                </div>
              </div>
              <div>
                <Tooltip
                  content={
                    <TooltipContent
                      title="Oracle Price"
                      detail={`1 ${market.collateralAsset.symbol} = ${Number(oraclePrice).toPrecision(6)} ${market.loanAsset.symbol}`}
                    />
                  }
                >
                  <div className="cursor-help">
                    <p className="text-xs uppercase tracking-wider text-secondary">Oracle</p>
                    <p className="tabular-nums text-lg">{Number(oraclePrice).toFixed(2)}</p>
                  </div>
                </Tooltip>
              </div>
            </div>

            {/* Position Pill + Actions Dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              {userPosition && (
                <PositionPill
                  position={userPosition}
                  onSupplyClick={onSupplyClick}
                  onBorrowClick={onBorrowClick}
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="xs"
                    variant="surface"
                    className="px-0"
                  >
                    <IoEllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={onSupplyClick}
                    startContent={<BsArrowUpCircle className="h-4 w-4" />}
                  >
                    Supply
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onBorrowClick}
                    startContent={<BsArrowDownLeftCircle className="h-4 w-4" />}
                  >
                    Borrow
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.open(getMarketURL(marketId, network), '_blank')}
                    startContent={<FiExternalLink className="h-4 w-4" />}
                  >
                    View on Morpho
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Stats Row - Visible only on small screens */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4 lg:hidden">
          <div>
            <p className="text-xs text-secondary">Supply {rateLabel}</p>
            <div className="flex items-center gap-1">
              <p className="tabular-nums">{formatRate(market.state.supplyApy)}</p>
              <CampaignBadge
                {...campaignBadgeProps}
                filterType="supply"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-secondary">Borrow {rateLabel}</p>
            <div className="flex items-center gap-1">
              <p className="tabular-nums">{formatRate(market.state.borrowApy)}</p>
              <CampaignBadge
                {...campaignBadgeProps}
                filterType="borrow"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-secondary">Oracle</p>
            <p className="tabular-nums">{Number(oraclePrice).toFixed(2)}</p>
          </div>
        </div>

        {/* Advanced Details - Expandable */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between text-sm text-secondary hover:text-primary"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            {renderSummaryBadges()}
            <div className="flex items-center gap-2">
              <span>Advanced Details</span>
              <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4">
                  {/* Global Warnings (debt + general) at top */}
                  <WarningBlock
                    warnings={globalWarnings}
                    riskLevel={globalRiskLevel}
                  />

                  {/* Two-column grid */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* LEFT: Market Configuration */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs uppercase tracking-wider text-secondary">Market Configuration</h4>
                        <RiskIcon level={assetRiskLevel} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-secondary">Loan:</span>
                          <AddressIdentity
                            address={market.loanAsset.address}
                            chainId={market.morphoBlue.chain.id}
                            label={market.loanAsset.symbol}
                            isToken
                            tokenSymbol={market.loanAsset.symbol}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-secondary">Collateral:</span>
                          <AddressIdentity
                            address={market.collateralAsset.address}
                            chainId={market.morphoBlue.chain.id}
                            label={market.collateralAsset.symbol}
                            isToken
                            tokenSymbol={market.collateralAsset.symbol}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-secondary">IRM:</span>
                          <AddressIdentity
                            address={market.irmAddress}
                            chainId={market.morphoBlue.chain.id}
                            label={getIRMTitle(market.irmAddress)}
                          />
                        </div>
                      </div>

                      {/* Asset warnings */}
                      <WarningBlock
                        warnings={assetWarnings}
                        riskLevel={assetRiskLevel}
                      />
                    </div>

                    {/* RIGHT: Oracle */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs uppercase tracking-wider text-secondary">Oracle</h4>
                        <RiskIcon level={oracleRiskLevel} />
                      </div>

                      <OracleTypeInfo
                        oracleData={market.oracle?.data}
                        oracleAddress={market.oracleAddress}
                        chainId={market.morphoBlue.chain.id}
                        useBadge
                      />

                      {/* Oracle warnings */}
                      <WarningBlock
                        warnings={oracleWarnings}
                        riskLevel={oracleRiskLevel}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

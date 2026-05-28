import type { ReactNode } from 'react';
import type { Address } from 'viem';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { IoIosSwap } from 'react-icons/io';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import { PulseLoader } from 'react-spinners';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { AccountIdentity } from '@/components/shared/account-identity';
import { TooltipContent } from '@/components/shared/tooltip-content';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { formatReadable } from '@/utils/balance';
import { formatUsdValue, type AssetBreakdownItem, type PortfolioAnalytics } from '@/utils/portfolio';
import { PortfolioValueBadge } from './portfolio-value-badge';
import { AccountVaultInfo } from './account-vault-info';

type PortfolioAnalyticsBannerProps = {
  account: string;
  accountChainId?: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  period: EarningsPeriod;
  onPeriodChange: (period: EarningsPeriod) => void;
  rateLabel: string;
  isAprDisplay: boolean;
  totalUsd: number;
  totalDebtUsd: number;
  assetBreakdown: AssetBreakdownItem[];
  debtBreakdown: AssetBreakdownItem[];
  portfolioAnalytics: PortfolioAnalytics;
  isValueLoading: boolean;
  isEarningsLoading: boolean;
  valueError: Error | null;
  showPortfolioStats: boolean;
  onSwap: () => void;
};

const METRIC_TEXT_CLASS = 'font-zen text-2xl font-normal tabular-nums sm:text-2xl';

const PERIOD_OPTIONS: { value: EarningsPeriod; label: string }[] = [
  { value: 'day', label: '24 hours' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
  { value: 'threemonth', label: '3 months' },
  { value: 'sixmonth', label: '6 months' },
  { value: 'all', label: 'all time' },
];

const getPeriodLabel = (period: EarningsPeriod): string =>
  PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? period;

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  return `${formatReadable(value * 100)}%`;
}

function getPricingCoverageLabel(analytics: PortfolioAnalytics): string {
  if (analytics.totalPositionCount === 0) {
    return 'No supply history';
  }

  if (analytics.unpricedPositionCount > 0) {
    return `${analytics.pricedPositionCount}/${analytics.totalPositionCount} markets priced`;
  }

  return 'Current prices';
}

function MetricBlock({
  label,
  tooltipTitle,
  value,
  caption,
  detail,
  isLoading,
}: {
  label: ReactNode;
  tooltipTitle: string;
  value: string;
  caption: string;
  detail: string;
  isLoading: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-h-4 flex-wrap items-center gap-2 text-xs text-secondary">{label}</div>
      <Tooltip
        content={
          <TooltipContent
            title={tooltipTitle}
            detail={detail}
          />
        }
        placement="bottom"
      >
        <div className="cursor-help">
          {isLoading ? (
            <div className={`${METRIC_TEXT_CLASS} flex min-h-8 items-center sm:min-h-9`}>
              <PulseLoader
                size={4}
                color="#f45f2d"
                margin={2}
              />
            </div>
          ) : (
            <div className={METRIC_TEXT_CLASS}>{value}</div>
          )}
          <div className="truncate text-xs text-secondary">{caption}</div>
        </div>
      </Tooltip>
    </div>
  );
}

function PeriodTextMenu({
  period,
  onPeriodChange,
}: {
  period: EarningsPeriod;
  onPeriodChange: (period: EarningsPeriod) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded-sm text-xs text-secondary underline decoration-dotted underline-offset-4 transition-colors hover:text-primary focus:outline-none focus:ring-1 focus:ring-[var(--palette-orange)]"
        >
          {getPeriodLabel(period)}
          <ChevronDownIcon className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[9rem] p-1"
      >
        <DropdownMenuRadioGroup
          value={period}
          onValueChange={(value) => onPeriodChange(value as EarningsPeriod)}
        >
          {PERIOD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PortfolioAnalyticsBanner({
  account,
  accountChainId,
  isBookmarked,
  onToggleBookmark,
  period,
  onPeriodChange,
  rateLabel,
  isAprDisplay,
  totalUsd,
  totalDebtUsd,
  assetBreakdown,
  debtBreakdown,
  portfolioAnalytics,
  isValueLoading,
  isEarningsLoading,
  valueError,
  showPortfolioStats,
  onSwap,
}: PortfolioAnalyticsBannerProps) {
  const analyticsLoading = isValueLoading || isEarningsLoading;
  const displayRate = isAprDisplay ? portfolioAnalytics.annualizedApr : portfolioAnalytics.annualizedApy;
  const pricingCoverageLabel = getPricingCoverageLabel(portfolioAnalytics);
  const selectedPeriodLabel = getPeriodLabel(period);
  const averageRateTitle = `Average ${rateLabel} over ${selectedPeriodLabel}`;
  const rateDetail = `${rateLabel} uses current token prices to normalize Morpho Blue supply earnings and supplied capital over ${selectedPeriodLabel}. Exited supplies from the period are included.`;
  const earningsDetail = 'Net interest earned by Morpho Blue supply positions during the selected period, converted with current token prices.';

  return (
    <div className="rounded-md bg-surface px-4 py-3 font-zen shadow-sm sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <AccountIdentity
              address={account as Address}
              variant="full"
              showAddress
              chainId={accountChainId}
            />
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 px-1 text-secondary hover:bg-transparent hover:text-primary"
              aria-label={isBookmarked ? 'Remove address bookmark' : 'Bookmark address'}
              onClick={onToggleBookmark}
            >
              {isBookmarked ? <RiBookmarkFill className="h-4 w-4" /> : <RiBookmarkLine className="h-4 w-4" />}
            </Button>
          </div>
          <AccountVaultInfo account={account as Address} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            onClick={onSwap}
            title="Swap tokens"
          >
            <IoIosSwap className="h-4 w-4" />
            Swap
          </Button>
        </div>
      </div>

      {showPortfolioStats && (
        <div className="mt-4 border-t border-dashed border-border/70 pt-4">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(2,minmax(170px,0.7fr))]">
            <PortfolioValueBadge
              totalUsd={totalUsd}
              totalDebtUsd={totalDebtUsd}
              assetBreakdown={assetBreakdown}
              debtBreakdown={debtBreakdown}
              isLoading={isValueLoading}
              error={valueError}
              align="start"
              className="min-w-0"
            />
            <MetricBlock
              label={
                <>
                  <span>{`Portfolio ${rateLabel}`}</span>
                  <PeriodTextMenu
                    period={period}
                    onPeriodChange={onPeriodChange}
                  />
                </>
              }
              tooltipTitle={averageRateTitle}
              value={valueError ? '—' : formatRate(displayRate)}
              caption={pricingCoverageLabel}
              detail={rateDetail}
              isLoading={analyticsLoading}
            />
            <MetricBlock
              label="Interest Earned"
              tooltipTitle={`Interest earned over ${selectedPeriodLabel}`}
              value={valueError ? '—' : formatUsdValue(portfolioAnalytics.totalEarningsUsd)}
              caption={pricingCoverageLabel}
              detail={earningsDetail}
              isLoading={analyticsLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

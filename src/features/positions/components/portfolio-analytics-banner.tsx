import type { Address } from 'viem';
import { IoIosSwap } from 'react-icons/io';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import { PulseLoader } from 'react-spinners';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { AccountIdentity } from '@/components/shared/account-identity';
import { TooltipContent } from '@/components/shared/tooltip-content';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { formatReadable } from '@/utils/balance';
import { formatUsdValue, type AssetBreakdownItem, type PortfolioAnalytics } from '@/utils/portfolio';
import { PortfolioValueBadge } from './portfolio-value-badge';
import { AccountVaultInfo } from './account-vault-info';
import { getPositionsPeriodLabel, getPositionsPeriodShortLabel, PositionsPeriodSettingsButton } from './positions-period-settings';

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

const SUPPORT_VALUE_CLASS = 'font-zen text-sm font-normal tabular-nums text-primary';

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

function SupportingMetric({
  label,
  tooltipTitle,
  value,
  caption,
  detail,
  isLoading,
}: {
  label: string;
  tooltipTitle: string;
  value: string;
  caption?: string;
  detail: string;
  isLoading: boolean;
}) {
  return (
    <div className="min-w-[116px]">
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
          <div className="text-xs text-secondary">{label}</div>
          {isLoading ? (
            <div className={`${SUPPORT_VALUE_CLASS} flex min-h-5 items-center`}>
              <PulseLoader
                size={4}
                color="#f45f2d"
                margin={2}
              />
            </div>
          ) : (
            <div className={SUPPORT_VALUE_CLASS}>{value}</div>
          )}
          {caption && <div className="truncate text-xs text-secondary">{caption}</div>}
        </div>
      </Tooltip>
    </div>
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
  const selectedPeriodLabel = getPositionsPeriodLabel(period);
  const selectedPeriodShortLabel = getPositionsPeriodShortLabel(period);
  const averageRateTitle = `Average ${rateLabel} over ${selectedPeriodLabel}`;
  const rateDetail = `${rateLabel} uses current token prices to normalize Morpho Blue supply earnings and supplied capital over ${selectedPeriodLabel}. Exited supplies from the period are included.`;
  const earningsDetail = `Net interest earned by Morpho Blue supply positions over ${selectedPeriodLabel}, converted with current token prices.`;

  return (
    <div className="rounded-md bg-surface px-4 py-3 font-zen shadow-sm sm:px-5">
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
          <PositionsPeriodSettingsButton
            period={period}
            onPeriodChange={onPeriodChange}
          />
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
        <div className="mt-3 border-t border-dashed border-border/70 pt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
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
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2 md:justify-end">
              <SupportingMetric
                label={`Portfolio ${rateLabel} (${selectedPeriodShortLabel})`}
                tooltipTitle={averageRateTitle}
                value={valueError ? '—' : formatRate(displayRate)}
                caption={pricingCoverageLabel}
                detail={rateDetail}
                isLoading={analyticsLoading}
              />
              <SupportingMetric
                label={`Interest (${selectedPeriodShortLabel})`}
                tooltipTitle={`Interest earned over ${selectedPeriodLabel}`}
                value={valueError ? '—' : formatUsdValue(portfolioAnalytics.totalEarningsUsd)}
                detail={earningsDetail}
                isLoading={analyticsLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

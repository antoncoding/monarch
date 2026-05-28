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
import { getPositionsPeriodLabel, PositionsPeriodSettingsButton } from './positions-period-settings';

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

const RATE_VALUE_CLASS = 'font-zen text-xl font-normal leading-none tabular-nums text-primary';

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

function PortfolioRateMetric({
  label,
  periodLabel,
  tooltipTitle,
  value,
  caption,
  detail,
  isLoading,
}: {
  label: string;
  periodLabel: string;
  tooltipTitle: string;
  value: string;
  caption?: string;
  detail: string;
  isLoading: boolean;
}) {
  return (
    <div className="min-w-[128px]">
      <Tooltip
        content={
          <TooltipContent
            title={tooltipTitle}
            detail={detail}
          />
        }
        placement="bottom"
      >
        <div className="flex cursor-help flex-col gap-1">
          <div className="text-xs leading-4 text-secondary">{label}</div>
          {isLoading ? (
            <div className={`${RATE_VALUE_CLASS} flex min-h-6 items-center`}>
              <PulseLoader
                size={4}
                color="#f45f2d"
                margin={2}
              />
            </div>
          ) : (
            <div className={RATE_VALUE_CLASS}>{value}</div>
          )}
          <div className="truncate text-xs leading-4 text-secondary">
            {periodLabel}
            {caption ? `, ${caption}` : ''}
          </div>
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
  const averageRateTitle = `Average ${rateLabel} over ${selectedPeriodLabel}`;
  const earningsValue = valueError ? '—' : formatUsdValue(portfolioAnalytics.totalEarningsUsd);
  const rateDetail = `${rateLabel} uses current token prices to normalize Morpho Blue supply earnings and supplied capital over ${selectedPeriodLabel}. Exited supplies from the period are included. Interest earned: ${earningsValue}.`;

  return (
    <div className="flex flex-col gap-4 font-zen sm:flex-row sm:items-start sm:justify-between">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">
        {showPortfolioStats && (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3 sm:justify-end">
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
            <PortfolioRateMetric
              label={`Portfolio ${rateLabel}`}
              periodLabel={selectedPeriodLabel}
              tooltipTitle={averageRateTitle}
              value={valueError ? '—' : formatRate(displayRate)}
              caption={pricingCoverageLabel}
              detail={rateDetail}
              isLoading={analyticsLoading}
            />
          </div>
        )}
        <div
          className={`flex flex-wrap items-center gap-2 sm:justify-end ${
            showPortfolioStats ? 'sm:ml-2 sm:border-l sm:border-dashed sm:border-border/70 sm:pl-6' : ''
          }`}
        >
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
    </div>
  );
}

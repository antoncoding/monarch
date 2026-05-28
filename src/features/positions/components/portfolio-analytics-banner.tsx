import type { Address } from 'viem';
import { IoIosSwap } from 'react-icons/io';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import { PulseLoader } from 'react-spinners';
import { Button } from '@/components/ui/button';
import { AccountIdentity } from '@/components/shared/account-identity';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { formatReadable } from '@/utils/balance';
import type { AssetBreakdownItem, PortfolioAnalytics } from '@/utils/portfolio';
import { PortfolioValueBadge } from './portfolio-value-badge';
import { AccountVaultInfo } from './account-vault-info';
import { getPositionsPeriodShortLabel, PositionsPeriodSettingsButton } from './positions-period-settings';

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

const INLINE_RATE_VALUE_CLASS = 'font-zen text-sm font-normal leading-none tabular-nums text-primary';

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  return `${formatReadable(value * 100)}%`;
}

function PortfolioRateInlineMetric({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm bg-hovered px-1.5 py-0.5 text-xs leading-none text-secondary">
      <span>{label}</span>
      {isLoading ? (
        <span className={`${INLINE_RATE_VALUE_CLASS} inline-flex min-h-4 items-center`}>
          <PulseLoader
            size={3}
            color="#f45f2d"
            margin={1}
          />
        </span>
      ) : (
        <span className={INLINE_RATE_VALUE_CLASS}>{value}</span>
      )}
    </span>
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
  const selectedPeriodShortLabel = getPositionsPeriodShortLabel(period);

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
              depositInlineMetric={
                <PortfolioRateInlineMetric
                  label={`${selectedPeriodShortLabel} ${rateLabel}`}
                  value={valueError ? '—' : formatRate(displayRate)}
                  isLoading={analyticsLoading}
                />
              }
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

import type { ReactNode } from 'react';
import type { Address } from 'viem';
import { IoIosSwap } from 'react-icons/io';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import { PulseLoader } from 'react-spinners';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { AccountIdentity } from '@/components/shared/account-identity';
import { TokenIcon } from '@/components/shared/token-icon';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { formatReadable, formatReadableTokenAmount } from '@/utils/balance';
import { cn } from '@/utils/components';
import { type AssetBreakdownItem, formatUsdValue, type PortfolioAnalytics } from '@/utils/portfolio';
import { AccountVaultInfo } from './account-vault-info';
import { PositionsPeriodSettingsButton } from './positions-period-settings';

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
  depositPositionCount: number;
  debtMarketCount: number;
  assetBreakdown: AssetBreakdownItem[];
  debtBreakdown: AssetBreakdownItem[];
  portfolioAnalytics: PortfolioAnalytics;
  isValueLoading: boolean;
  isEarningsLoading: boolean;
  valueError: Error | null;
  showPortfolioStats: boolean;
  onSwap: () => void;
};

const METRIC_VALUE_CLASS = 'font-zen text-xl font-normal leading-none tabular-nums text-primary';

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  return `${formatReadable(value * 100)}%`;
}

function formatCountCaption(count: number, noun: string): string {
  if (count <= 0) return '';

  return `from ${count} ${count === 1 ? noun : `${noun}s`}`;
}

function formatAnalyticsCaption(portfolioAnalytics: PortfolioAnalytics): string {
  if (portfolioAnalytics.totalPositionCount <= 0) {
    return '';
  }

  if (portfolioAnalytics.unpricedPositionCount > 0) {
    return `${portfolioAnalytics.pricedPositionCount}/${portfolioAnalytics.totalPositionCount} priced`;
  }

  return formatCountCaption(portfolioAnalytics.totalPositionCount, 'market');
}

function BreakdownTooltipContent({ items }: { items: AssetBreakdownItem[] }) {
  return (
    <div className="min-w-[180px] space-y-2">
      {items.map((item) => (
        <div
          key={`${item.tokenAddress}-${item.chainId}`}
          className="flex items-center justify-between text-xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <TokenIcon
              address={item.tokenAddress}
              chainId={item.chainId}
              symbol={item.symbol}
              width={16}
              height={16}
            />
            <span className="truncate">
              {formatReadableTokenAmount(item.balance, { precision: 2, minDisplayDecimals: 2 })} {item.symbol}
            </span>
          </div>
          <span className="ml-4 shrink-0 text-secondary">{formatUsdValue(item.usdValue)}</span>
        </div>
      ))}
    </div>
  );
}

function PortfolioMetricBox({
  label,
  value,
  caption,
  action,
  isLoading,
  error,
  muted = false,
  tooltip,
}: {
  label: string;
  value: string;
  caption: string;
  action?: ReactNode;
  isLoading: boolean;
  error?: Error | null;
  muted?: boolean;
  tooltip?: ReactNode;
}) {
  const content = (
    <div className="flex min-h-[5.25rem] min-w-0 flex-col justify-between rounded-sm border border-border bg-surface px-3 py-2.5 shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate font-monospace text-[10px] uppercase leading-4 tracking-[0.14em] text-secondary">{label}</span>
        {action}
      </div>
      <div className="mt-1.5 flex min-h-6 items-center">
        {isLoading ? (
          <PulseLoader
            size={4}
            color="#f45f2d"
            margin={2}
          />
        ) : error ? (
          <span className={cn(METRIC_VALUE_CLASS, 'text-secondary')}>—</span>
        ) : (
          <span className={cn(METRIC_VALUE_CLASS, muted && 'text-secondary')}>{value}</span>
        )}
      </div>
      {caption ? (
        <span className="mt-1 truncate text-xs leading-4 text-secondary">{caption}</span>
      ) : (
        <span
          className="mt-1 h-4"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (!tooltip || isLoading) {
    return content;
  }

  return (
    <Tooltip
      content={tooltip}
      placement="bottom"
    >
      <div className="cursor-help">{content}</div>
    </Tooltip>
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
  depositPositionCount,
  debtMarketCount,
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
  const averageRateLabel = `AVERAGE ${rateLabel}`;

  return (
    <div className="flex flex-col gap-3 font-zen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

        <Button
          variant="primary"
          onClick={onSwap}
          title="Swap tokens"
          className="shrink-0 self-start"
        >
          <IoIosSwap className="h-4 w-4" />
          Swap
        </Button>
      </div>

      {showPortfolioStats && (
        <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
          <PortfolioMetricBox
            label="TOTAL DEPOSIT"
            value={formatUsdValue(totalUsd)}
            caption={formatCountCaption(depositPositionCount, 'position')}
            isLoading={isValueLoading}
            error={valueError}
            tooltip={assetBreakdown.length > 0 ? <BreakdownTooltipContent items={assetBreakdown} /> : undefined}
          />
          <PortfolioMetricBox
            label={averageRateLabel}
            value={formatRate(displayRate)}
            caption={formatAnalyticsCaption(portfolioAnalytics)}
            action={
              <PositionsPeriodSettingsButton
                period={period}
                onPeriodChange={onPeriodChange}
              />
            }
            isLoading={analyticsLoading}
            error={valueError}
          />
          <PortfolioMetricBox
            label="TOTAL DEBT"
            value={formatUsdValue(totalDebtUsd)}
            caption={formatCountCaption(debtMarketCount, 'market')}
            isLoading={isValueLoading}
            error={valueError}
            muted={totalDebtUsd <= 0}
            tooltip={debtBreakdown.length > 0 ? <BreakdownTooltipContent items={debtBreakdown} /> : undefined}
          />
        </div>
      )}
    </div>
  );
}

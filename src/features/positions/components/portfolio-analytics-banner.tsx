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

interface PortfolioAnalyticsBannerProps {
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
}

const METRIC_VALUE_CLASS = 'font-zen text-[1.375rem] font-normal leading-none tabular-nums text-primary';

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  return `${formatReadable(value * 100)}%`;
}

function formatSourceCount(count: number, noun: string, plural = `${noun}s`): string | null {
  if (count <= 0) return null;

  return `${count} ${count === 1 ? noun : plural}`;
}

function joinSourceCounts(parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' + ');
}

function getBreakdownSourceCounts(items: AssetBreakdownItem[]) {
  let supplyMarketCount = 0;
  let vaultCount = 0;
  let borrowMarketCount = 0;

  for (const item of items) {
    supplyMarketCount += item.supplyMarketCount;
    vaultCount += item.vaultCount;
    borrowMarketCount += item.borrowMarketCount;
  }

  return { supplyMarketCount, vaultCount, borrowMarketCount };
}

function formatDepositSourceCaption(items: AssetBreakdownItem[]): string {
  const { supplyMarketCount, vaultCount } = getBreakdownSourceCounts(items);

  return joinSourceCounts([formatSourceCount(supplyMarketCount, 'market'), formatSourceCount(vaultCount, 'Auto Vault')]);
}

function formatDebtSourceCaption(items: AssetBreakdownItem[]): string {
  const { borrowMarketCount } = getBreakdownSourceCounts(items);

  return formatSourceCount(borrowMarketCount, 'borrow market') ?? '';
}

function formatAssetSourceDetail(item: AssetBreakdownItem): string {
  return joinSourceCounts([
    formatSourceCount(item.supplyMarketCount, 'Morpho market'),
    formatSourceCount(item.vaultCount, 'Auto Vault'),
    formatSourceCount(item.borrowMarketCount, 'borrow market'),
  ]);
}

function BreakdownTooltipContent({ title, items }: { title: string; items: AssetBreakdownItem[] }) {
  return (
    <div className="min-w-[220px] space-y-3">
      <div className="font-monospace text-[10px] uppercase leading-4 tracking-[0.14em] text-secondary">{title}</div>
      <div className="space-y-2">
        {items.map((item) => {
          const sourceDetail = formatAssetSourceDetail(item);

          return (
            <div
              key={`${item.tokenAddress}-${item.chainId}`}
              className="flex items-start justify-between gap-4 text-xs"
            >
              <div className="min-w-0">
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
                {sourceDetail && <div className="mt-0.5 pl-6 text-[11px] leading-4 text-secondary">{sourceDetail}</div>}
              </div>
              <span className="shrink-0 text-secondary">{formatUsdValue(item.usdValue)}</span>
            </div>
          );
        })}
      </div>
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
    <div className="flex h-full min-h-[5.25rem] min-w-0 flex-col rounded border border-border bg-surface px-4 py-3 shadow-[0_1px_1px_rgb(0_0_0_/_0.025)] dark:shadow-none">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate font-monospace text-[10px] uppercase leading-4 tracking-[0.14em] text-secondary">{label}</span>
        {action}
      </div>
      <div className="mt-2 flex min-h-6 items-center">
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
        <span className="mt-1 break-words text-[11px] leading-4 text-secondary">{caption}</span>
      ) : (
        <span
          className="mt-1 min-h-4"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (!tooltip || isLoading) {
    return <div className="h-full min-w-0">{content}</div>;
  }

  return (
    <Tooltip
      content={tooltip}
      placement="bottom"
    >
      <div className="h-full min-w-0 cursor-help">{content}</div>
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
          className="hidden h-9 shrink-0 self-start sm:inline-flex"
        >
          <IoIosSwap className="h-4 w-4" />
          Swap
        </Button>
      </div>

      {showPortfolioStats && (
        <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-2 sm:grid-cols-[1.08fr_0.92fr_0.92fr]">
          <PortfolioMetricBox
            label="TOTAL DEPOSIT"
            value={formatUsdValue(totalUsd)}
            caption={formatDepositSourceCaption(assetBreakdown)}
            isLoading={isValueLoading}
            error={valueError}
            tooltip={
              assetBreakdown.length > 0 ? (
                <BreakdownTooltipContent
                  title="Deposit sources"
                  items={assetBreakdown}
                />
              ) : undefined
            }
          />
          <PortfolioMetricBox
            label={averageRateLabel}
            value={formatRate(displayRate)}
            caption=""
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
            caption={formatDebtSourceCaption(debtBreakdown)}
            isLoading={isValueLoading}
            error={valueError}
            muted={totalDebtUsd <= 0}
            tooltip={
              debtBreakdown.length > 0 ? (
                <BreakdownTooltipContent
                  title="Debt sources"
                  items={debtBreakdown}
                />
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

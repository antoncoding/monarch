import { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { LuDroplets } from 'react-icons/lu';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnits } from 'viem';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getIRMTitle, previewMarketState } from '@/utils/morpho';
import { getTruncatedAssetName } from '@/utils/oracle';
import { convertApyToApr } from '@/utils/rateMath';
import type { Market } from '@/utils/types';
import OracleVendorBadge from './oracle-vendor-badge';
import { TokenIcon } from '@/components/shared/token-icon';

type MarketDetailsBlockProps = {
  market: Market;
  showDetailsLink?: boolean;
  defaultCollapsed?: boolean;
  mode?: 'supply' | 'borrow';
  showRewards?: boolean;
  disableExpansion?: boolean;
  supplyDelta?: bigint;
  borrowDelta?: bigint;
  /** Extra liquidity available from Public Allocator vaults (in raw token units) */
  extraLiquidity?: bigint;
};

export function MarketDetailsBlock({
  market,
  showDetailsLink = false,
  defaultCollapsed = false,
  mode = 'supply',
  showRewards = false,
  disableExpansion = false,
  supplyDelta,
  borrowDelta,
  extraLiquidity,
}: MarketDetailsBlockProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed && !disableExpansion);

  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const { activeCampaigns, hasActiveRewards } = useMarketCampaigns({
    marketId: market.uniqueKey,
    loanTokenAddress: market.loanAsset.address,
    chainId: market.morphoBlue.chain.id,
    whitelisted: market.whitelisted,
  });

  // Calculate preview state when supplyDelta or borrowDelta is provided
  const previewState = useMemo(() => {
    // For supply mode: show preview if supplyDelta is non-zero
    if (mode === 'supply' && supplyDelta && supplyDelta !== 0n) {
      return previewMarketState(market, supplyDelta, undefined);
    }

    // For borrow mode: show preview if borrowDelta is non-zero
    if (mode === 'borrow' && borrowDelta && borrowDelta !== 0n) {
      return previewMarketState(market, undefined, borrowDelta);
    }

    return null;
  }, [market, supplyDelta, borrowDelta, mode]);

  // Helper to format rate based on mode
  const getRate = () => {
    const apy = mode === 'supply' ? market.state.supplyApy : market.state.borrowApy;
    const rate = isAprDisplay ? convertApyToApr(apy) : apy;
    return (rate * 100).toFixed(2);
  };

  const getPreviewRate = () => {
    if (!previewState) return null;
    const apy = mode === 'supply' ? previewState.supplyApy : previewState.borrowApy;
    if (!apy) return null;
    const rate = isAprDisplay ? convertApyToApr(apy) : apy;
    return (rate * 100).toFixed(2);
  };

  return (
    <div>
      {/* Collapsible Market Details */}
      <div
        className={`bg-hovered font-zen rounded transition-colors ${disableExpansion ? '' : 'cursor-pointer'}`}
        onClick={() => !disableExpansion && setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (!disableExpansion && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        role={disableExpansion ? undefined : 'button'}
        tabIndex={disableExpansion ? undefined : 0}
        aria-expanded={disableExpansion ? undefined : isExpanded}
        aria-label={disableExpansion ? undefined : `${isExpanded ? 'Collapse' : 'Expand'} market details`}
      >
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <div className="z-10">
                <TokenIcon
                  address={market.loanAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.loanAsset.symbol}
                  width={20}
                  height={20}
                />
              </div>
              <div className="bg-surface -ml-2.5">
                <TokenIcon
                  address={market.collateralAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.collateralAsset.symbol}
                  width={20}
                  height={20}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{getTruncatedAssetName(market.loanAsset.symbol)}</span>
              <span className="text-xs opacity-50">/ {getTruncatedAssetName(market.collateralAsset.symbol)}</span>
              {showDetailsLink && (
                <a
                  href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
                  target="_blank"
                  className="ml-1 opacity-50 transition-opacity hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              )}
            </div>
            {!isExpanded && (
              <div className="flex items-center gap-2 text-xs opacity-70">
                <span>·</span>
                <OracleVendorBadge
                  oracleData={market.oracle?.data}
                  showText={false}
                  chainId={market.morphoBlue.chain.id}
                />
                <span>·</span>
                {previewState !== null ? (
                  <span>
                    <span className="line-through opacity-50">{getRate()}%</span>
                    {' → '}
                    <span className="font-semibold">{getPreviewRate()}%</span> {rateLabel}
                  </span>
                ) : (
                  <span>
                    {getRate()}% {rateLabel}
                  </span>
                )}
                <span>·</span>
                <span>{(Number(market.lltv) / 1e16).toFixed(0)}% LLTV</span>
              </div>
            )}
          </div>

          {!disableExpansion && (
            <div className="text-primary opacity-70 hover:opacity-100">{isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}</div>
          )}
        </div>

        {/* Expanded Market Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-100 p-4 dark:border-gray-700">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <OracleVendorBadge
                      oracleData={market.oracle?.data}
                      showText
                      useTooltip={false}
                      chainId={market.morphoBlue.chain.id}
                    />
                    <span className="text-xs opacity-50">·</span>
                    <span className="text-xs opacity-70">{getIRMTitle(market.irmAddress)}</span>
                    <span className="text-xs opacity-50">·</span>
                    <span className="text-xs opacity-70">{formatUnits(BigInt(market.lltv), 16)}%</span>
                  </div>
                </div>
                <div className="w-full">
                  <p className="mb-2 font-zen text-sm">Market State</p>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">
                        {mode === 'supply' ? 'Supply' : 'Borrow'} {rateLabel}:
                      </p>
                      {previewState !== null ? (
                        <p className="text-right text-sm font-bold">
                          <span className="line-through opacity-50">{getRate()}%</span>
                          {' → '}
                          <span>{getPreviewRate()}%</span>
                        </p>
                      ) : (
                        <p className="text-right text-sm font-bold">{getRate()}%</p>
                      )}
                    </div>
                    {showRewards && hasActiveRewards && (
                      <div className="flex items-start justify-between">
                        <p className="flex items-center gap-1 font-zen text-sm opacity-50">Extra Rewards:</p>
                        <div className="flex items-center gap-1">
                          <p className="text-right text-sm font-bold text-green-600 dark:text-green-400">
                            +{activeCampaigns.reduce((sum, c) => sum + c.apr, 0).toFixed(2)}%
                          </p>
                          {activeCampaigns.map((campaign, index) => (
                            <TokenIcon
                              key={index}
                              address={campaign.rewardToken.address}
                              chainId={campaign.chainId}
                              symbol={campaign.rewardToken.symbol}
                              width={16}
                              height={16}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">Total Supply:</p>
                      {previewState !== null ? (
                        <p className="text-right text-sm">
                          <span className="line-through opacity-50">
                            {formatReadable(formatBalance(market.state.supplyAssets, market.loanAsset.decimals))}
                          </span>
                          {' → '}
                          <span>{formatReadable(formatBalance(previewState.totalSupplyAssets.toString(), market.loanAsset.decimals))}</span>
                        </p>
                      ) : (
                        <p className="text-right text-sm">
                          {formatReadable(formatBalance(market.state.supplyAssets, market.loanAsset.decimals))}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">Liquidity:</p>
                      <div className="flex items-center gap-1">
                        {previewState !== null ? (
                          <p className="text-right font-zen text-sm">
                            <span className="line-through opacity-50">
                              {formatReadable(formatBalance(market.state.liquidityAssets, market.loanAsset.decimals))}
                            </span>
                            {' → '}
                            <span>{formatReadable(formatBalance(previewState.liquidityAssets.toString(), market.loanAsset.decimals))}</span>
                          </p>
                        ) : (
                          <p className="text-right font-zen text-sm">
                            {formatReadable(formatBalance(market.state.liquidityAssets, market.loanAsset.decimals))}
                          </p>
                        )}
                        {extraLiquidity != null && extraLiquidity > 0n && (
                          <Tooltip
                            className="z-[2000]"
                            content={`+${formatReadable(formatBalance(extraLiquidity.toString(), market.loanAsset.decimals))} ${market.loanAsset.symbol} available from Public Allocator vaults`}
                          >
                            <LuDroplets className="mr-0.5 h-3 w-3" />
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">Utilization:</p>
                      {previewState !== null ? (
                        <p className="text-right text-sm">
                          <span className="line-through opacity-50">{formatReadable(market.state.utilization * 100)}%</span>
                          {' → '}
                          <span>{formatReadable(previewState.utilization * 100)}%</span>
                        </p>
                      ) : (
                        <p className="text-right text-sm">{formatReadable(market.state.utilization * 100)}%</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

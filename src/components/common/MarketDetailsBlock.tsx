import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnits } from 'viem';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getIRMTitle } from '@/utils/morpho';
import { Market } from '@/utils/types';
import OracleVendorBadge from '../OracleVendorBadge';
import { TokenIcon } from '../TokenIcon';

type MarketDetailsBlockProps = {
  market: Market;
  showDetailsLink?: boolean;
  defaultCollapsed?: boolean;
  mode?: 'supply' | 'borrow';
};

export function MarketDetailsBlock({
  market,
  showDetailsLink = false,
  defaultCollapsed = false,
  mode = 'supply',
}: MarketDetailsBlockProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

  // Helper to format APY based on mode
  const getAPY = () => {
    const apy = mode === 'supply' ? market.state.supplyApy : market.state.borrowApy;
    return (apy * 100).toFixed(2);
  };

  return (
    <div>
      {/* Collapsible Market Details */}
      <div
        className="bg-hovered cursor-pointer rounded transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} market details`}
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
              <span className="text-sm font-medium">{market.loanAsset.symbol}</span>
              <span className="text-xs opacity-50">/ {market.collateralAsset.symbol}</span>
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
                <OracleVendorBadge oracleData={market.oracle?.data} showText={false} useTooltip />
                <span>·</span>
                <span>{getAPY()}% APY</span>
                <span>·</span>
                <span>{(Number(market.lltv) / 1e16).toFixed(0)}% LLTV</span>
              </div>
            )}
          </div>

          <div className="text-primary opacity-70 hover:opacity-100">
            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </div>
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
                    />
                    <span className="text-xs opacity-50">·</span>
                    <span className="text-xs opacity-70">{getIRMTitle(market.irmAddress)}</span>
                    <span className="text-xs opacity-50">·</span>
                    <span className="text-xs opacity-70">
                      {formatUnits(BigInt(market.lltv), 16)}%
                    </span>
                  </div>
                </div>
                <div className="w-full">
                  <p className="mb-2 font-zen text-sm">Market State</p>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">
                        {mode === 'supply' ? 'Supply' : 'Borrow'} APY:
                      </p>
                      <p className="text-right text-sm font-bold">{getAPY()}%</p>
                    </div>
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">Total Supply:</p>
                      <p className="text-right text-sm">
                        {formatReadable(
                          formatBalance(market.state.supplyAssets, market.loanAsset.decimals),
                        )}
                      </p>
                    </div>
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">Liquidity:</p>
                      <p className="text-right font-zen text-sm">
                        {formatReadable(
                          formatBalance(market.state.liquidityAssets, market.loanAsset.decimals),
                        )}
                      </p>
                    </div>
                    <div className="flex items-start justify-between">
                      <p className="font-zen text-sm opacity-50">Utilization:</p>
                      <p className="text-right text-sm">
                        {formatReadable(market.state.utilization * 100)}%
                      </p>
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

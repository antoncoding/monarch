import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnits } from 'viem';
import { getTruncatedAssetName } from '@/utils/oracle';
import { Market } from '@/utils/types';
import OracleVendorBadge from '../OracleVendorBadge';
import { TokenIcon } from '../TokenIcon';

type MarketCapInputCompactProps = {
  market: Market;
  relativeCap: string;
  absoluteCap: string;
  onRelativeCapChange: (value: string) => void;
  onAbsoluteCapChange: (value: string) => void;
  isSelected?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
};

export function MarketCapInputCompact({
  market,
  relativeCap,
  absoluteCap,
  onRelativeCapChange,
  onAbsoluteCapChange,
  isSelected = false,
  onToggle,
  disabled = false,
}: MarketCapInputCompactProps): JSX.Element {
  const [relativeCapError, setRelativeCapError] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRelativeCapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty or valid decimal numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onRelativeCapChange(value);

      // Validate percentage (0-100)
      if (value !== '') {
        const numValue = parseFloat(value);
        if (numValue > 100) {
          setRelativeCapError('Max 100%');
        } else if (numValue < 0) {
          setRelativeCapError('Must be positive');
        } else {
          setRelativeCapError('');
        }
      } else {
        setRelativeCapError('');
      }
    }
  };

  const handleAbsoluteCapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty or valid numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onAbsoluteCapChange(value);
    }
  };

  return (
    <div
      className={`rounded border transition-all duration-200 ease-in-out ${
        isSelected
          ? 'border-primary bg-primary/5 dark:bg-primary/10'
          : 'border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/50'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            disabled={disabled}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary dark:border-gray-600"
          />
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
            <span className="text-sm font-medium">
              {getTruncatedAssetName(market.loanAsset.symbol)}
            </span>
            <span className="text-xs opacity-50">
              / {getTruncatedAssetName(market.collateralAsset.symbol)}
            </span>
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
              <span>{market.state?.supplyApy ? (market.state.supplyApy * 100).toFixed(2) : '0.00'}% APY</span>
              <span>·</span>
              <span>{formatUnits(BigInt(market.lltv), 16)}% LTV</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary opacity-70 hover:opacity-100 disabled:opacity-30"
          disabled={!isSelected}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </button>
      </div>

      {/* Expanded Details with Cap Inputs */}
      <AnimatePresence>
        {isExpanded && isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-secondary">
                  Relative Cap (% of vault)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="0"
                    value={relativeCap}
                    onChange={handleRelativeCapChange}
                    disabled={disabled}
                    aria-label="Relative cap percentage"
                    className={`h-10 w-full rounded bg-hovered p-2 focus:border-primary focus:outline-none ${
                      relativeCapError ? 'border border-red-500 focus:border-red-500' : ''
                    }`}
                  />
                  <span className="text-sm text-secondary">%</span>
                </div>
                {relativeCapError && <p className="text-xs text-red-500">{relativeCapError}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-secondary">
                  Absolute Cap ({market.loanAsset.symbol})
                </span>
                <input
                  type="text"
                  placeholder="0"
                  value={absoluteCap}
                  onChange={handleAbsoluteCapChange}
                  disabled={disabled}
                  aria-label="Absolute cap amount"
                  className="h-10 w-full rounded bg-hovered p-2 focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

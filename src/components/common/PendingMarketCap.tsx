import React, { useState } from 'react';
import { LuX } from 'react-icons/lu';
import { formatUnits } from 'viem';
import { getTruncatedAssetName } from '@/utils/oracle';
import { Market } from '@/utils/types';
import OracleVendorBadge from '../OracleVendorBadge';
import { TokenIcon } from '../TokenIcon';

type PendingMarketCapProps = {
  market: Market;
  relativeCap: string;
  onRelativeCapChange: (value: string) => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function PendingMarketCap({
  market,
  relativeCap,
  onRelativeCapChange,
  onRemove,
  disabled = false,
}: PendingMarketCapProps): JSX.Element {
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty or valid decimal numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onRelativeCapChange(value);

      // Validate percentage (0-100)
      if (value !== '') {
        const numValue = parseFloat(value);
        if (numValue > 100) {
          setError('Max 100%');
        } else if (numValue < 0) {
          setError('Must be positive');
        } else {
          setError('');
        }
      } else {
        setError('');
      }
    }
  };

  return (
    <div className="group rounded border border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
      <div className="flex items-start gap-4">
        {/* Market Info */}
        <div className="flex flex-1 items-center gap-3">
          <div className="flex items-center">
            <div className="z-10">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={24}
                height={24}
              />
            </div>
            <div className="bg-surface -ml-3">
              <TokenIcon
                address={market.collateralAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.collateralAsset.symbol}
                width={24}
                height={24}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {getTruncatedAssetName(market.loanAsset.symbol)} / {getTruncatedAssetName(market.collateralAsset.symbol)}
              </span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {formatUnits(BigInt(market.lltv), 16)}% LTV
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-secondary">
              <OracleVendorBadge
                oracleData={market.oracle?.data}
                showText={false}
                chainId={market.morphoBlue.chain.id}
              />
              <span>·</span>
              <span>{market.state?.supplyApy ? (market.state.supplyApy * 100).toFixed(2) : '0.00'}% APY</span>
            </div>
          </div>
        </div>

        {/* Cap Input */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary">Max allocation</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="100"
                value={relativeCap}
                onChange={handleChange}
                disabled={disabled}
                aria-label="Maximum allocation percentage"
                className={`h-10 w-24 rounded border bg-background px-3 text-right focus:border-primary focus:outline-none ${
                  error ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              />
              <span className="text-sm font-medium text-secondary">%</span>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-hovered text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            aria-label="Remove market"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

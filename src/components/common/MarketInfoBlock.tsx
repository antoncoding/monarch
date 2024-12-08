import React from 'react';
import Image from 'next/image';
import { Market } from '@/utils/types';
import { formatBalance } from '@/utils/balance';
import { findToken } from '@/utils/tokens';
import { formatUnits } from 'viem';
import OracleVendorBadge from '../OracleVendorBadge';

interface MarketAmountBlockProps {
  market: Market;
  amount?: bigint;
  lltv?: string;
  apy?: string;
  className?: string;
}

export function MarketAmountBlock({ 
  market, 
  amount, 
  className = '' 
}: MarketAmountBlockProps): JSX.Element {

  const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);

  return (
    <div
      key={market.uniqueKey}
      className="flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
    >
      <div className="flex items-center gap-3">
        {collateralToken?.img && (
          <div className="overflow-hidden rounded-full">
            <Image
              src={collateralToken.img}
              alt={market.collateralAsset.symbol}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {market.collateralAsset.symbol}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {formatUnits(BigInt(market.lltv), 16)}% LTV
            </span>
          </div>
          { amount ? <span className="text-xs text-gray-500">
            {formatBalance(amount, market.loanAsset.decimals)}{' '}
            {market.loanAsset.symbol}
          </span> : <OracleVendorBadge showText oracleData={market.oracle.data} /> }
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm">
          {(market.state.supplyApy * 100).toFixed(2)}%
        </div>
        <div className="text-xs text-gray-500">Supply APY</div>
      </div>
    </div>
  );
}

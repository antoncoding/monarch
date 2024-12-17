import React from 'react';
import Image from 'next/image';
import { formatUnits, maxUint256 } from 'viem';
import { formatBalance } from '@/utils/balance';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import OracleVendorBadge from '../OracleVendorBadge';

type MarketInfoBlockProps = {
  market: Market;
  amount?: bigint;
  className?: string;
};

export function MarketInfoBlock({ market, amount, className }: MarketInfoBlockProps): JSX.Element {
  const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);

  return (
    <div
      key={market.uniqueKey}
      className={`flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 transition-all duration-200 ease-in-out dark:border-gray-700 dark:bg-gray-900/50 ${className}`}
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
            <span className="font-medium">{market.collateralAsset.symbol}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {formatUnits(BigInt(market.lltv), 16)}% LTV
            </span>
          </div>
          {amount && amount !== maxUint256 ? (
            <span className="text-xs text-gray-500">
              {formatBalance(amount, market.loanAsset.decimals)} {market.loanAsset.symbol}
            </span>
          ) : (
            <OracleVendorBadge showText oracleData={market.oracle.data} useTooltip={false} />
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm">{(market.state.supplyApy * 100).toFixed(2)}%</div>
        <div className="text-xs text-gray-500">Supply APY</div>
      </div>
    </div>
  );
}

export function MarketInfoBlockCompact({
  market,
  amount,
  className,
}: MarketInfoBlockProps): JSX.Element {
  const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);

  return (
    <div
      key={market.uniqueKey}
      className={`flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 transition-all duration-200 ease-in-out dark:border-gray-700 dark:bg-gray-900/50 ${className}`}
    >
      <div className="flex items-center gap-3">
        {collateralToken?.img ? (
          <div className="overflow-hidden rounded-full">
            <Image
              src={collateralToken.img}
              alt={market.collateralAsset.symbol}
              width={20}
              height={20}
              className="h-8 w-8 rounded-full object-cover"
            />
          </div>
        ) : (
          <div
            key={market.collateralAsset.address}
            className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-gray-200 text-lg dark:bg-gray-700"
          >
            ?
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="min-w-[100px] font-medium">{market.collateralAsset.symbol}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {formatUnits(BigInt(market.lltv), 16)}% LTV
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {`${market.uniqueKey.slice(2, 8)}`}
            </span>
          </div>
        </div>
      </div>
      {amount && amount !== maxUint256 ? (
        <span className="text-xs text-gray-500">
          {formatBalance(amount, market.loanAsset.decimals)} {market.loanAsset.symbol}
        </span>
      ) : (
        <OracleVendorBadge showText oracleData={market.oracle.data} useTooltip={false} />
      )}
    </div>
  );
}

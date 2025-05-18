import React, { useState, useMemo } from 'react';
import { Input, Tooltip } from '@nextui-org/react';
import { Pagination } from '@nextui-org/react';
import { Button } from '@nextui-org/react';
import { FaArrowUp, FaArrowDown, FaStar, FaUser } from 'react-icons/fa';
import { formatUnits } from 'viem';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { useStaredMarkets } from '@/hooks/useStaredMarkets';
import { formatReadable } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { Market } from '@/utils/types';
import { MarketPosition } from '@/utils/types';
import {
  MarketAssetIndicator,
  MarketOracleIndicator,
  MarketDebtIndicator,
} from '../../markets/components/RiskIndicator';

import { PER_PAGE } from './RebalanceModal';

type MarketTablesProps = {
  eligibleMarkets: Market[];
  fromMarkets: (MarketPosition & { pendingDelta: number })[];
  toMarkets: Market[];
  fromFilter: string;
  toFilter: string;
  onFromFilterChange: (value: string) => void;
  onToFilterChange: (value: string) => void;
  onFromMarketSelect: (marketUniqueKey: string) => void;
  onToMarketSelect: (marketUniqueKey: string) => void;
  onSelectMax?: (marketUniqueKey: string, amount: number) => void;
  fromPagination: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  toPagination: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  selectedFromMarketUniqueKey: string;
  selectedToMarketUniqueKey: string;
};

enum ToMarketSortColumn {
  APY,
  TotalSupply,
  LLTV, // Added for future use
}

type SortableHeaderProps = {
  label: string;
  column: ToMarketSortColumn;
  currentSortColumn: ToMarketSortColumn | null;
  currentSortDirection: number;
  onClick: (column: ToMarketSortColumn) => void;
  className?: string;
};

function SortableHeader({
  label,
  column,
  currentSortColumn,
  currentSortDirection,
  onClick,
  className = 'px-4 py-2 text-left',
}: SortableHeaderProps) {
  const isSorted = currentSortColumn === column;
  const commonClass = 'flex items-center gap-1';
  const sortIcon =
    isSorted && (currentSortDirection === 1 ? <FaArrowUp size={12} /> : <FaArrowDown size={12} />);

  return (
    <th
      className={`${className} cursor-pointer hover:text-primary-500`}
      onClick={() => onClick(column)}
    >
      <div className={commonClass}>
        {label}
        {sortIcon}
      </div>
    </th>
  );
}

export function FromAndToMarkets({
  eligibleMarkets,
  fromMarkets,
  toMarkets,
  fromFilter,
  toFilter,
  onFromFilterChange,
  onToFilterChange,
  onFromMarketSelect,
  onToMarketSelect,
  onSelectMax,
  fromPagination,
  toPagination,
  selectedFromMarketUniqueKey,
  selectedToMarketUniqueKey,
}: MarketTablesProps) {
  const { staredIds } = useStaredMarkets();

  const [toSortColumn, setToSortColumn] = useState<ToMarketSortColumn | null>(
    ToMarketSortColumn.TotalSupply,
  );
  const [toSortDirection, setToSortDirection] = useState<number>(-1); // -1 for desc, 1 for asc

  const handleToSortChange = (column: ToMarketSortColumn) => {
    if (toSortColumn === column) {
      setToSortDirection(toSortDirection * -1);
    } else {
      setToSortColumn(column);
      setToSortDirection(-1); // Default to descending for new column
    }
  };

  const filteredFromMarkets = fromMarkets.filter(
    (marketPosition) =>
      marketPosition.market.uniqueKey.toLowerCase().includes(fromFilter.toLowerCase()) ||
      marketPosition.market.collateralAsset.symbol.toLowerCase().includes(fromFilter.toLowerCase()),
  );

  const filteredToMarkets = useMemo(() => {
    return toMarkets.filter(
      (market) =>
        market.uniqueKey.toLowerCase().includes(toFilter.toLowerCase()) ||
        market.collateralAsset.symbol.toLowerCase().includes(toFilter.toLowerCase()),
    );
  }, [toMarkets, toFilter]);

  const sortedAndFilteredToMarkets = useMemo(() => {
    let sorted = [...filteredToMarkets];
    if (toSortColumn !== null) {
      sorted.sort((a, b) => {
        let valA: number | bigint = 0;
        let valB: number | bigint = 0;

        switch (toSortColumn) {
          case ToMarketSortColumn.APY:
            valA = a.state.supplyApy;
            valB = b.state.supplyApy;
            break;
          case ToMarketSortColumn.TotalSupply:
            // Ensure consistent comparison, potentially convert to number if safe
            // For now, using BigInt comparison which is fine for sorting
            valA = BigInt(a.state.supplyAssets);
            valB = BigInt(b.state.supplyAssets);
            break;
          case ToMarketSortColumn.LLTV:
            valA = BigInt(a.lltv);
            valB = BigInt(b.lltv);
            break;
          default:
            return 0;
        }

        if (valA < valB) return -1 * toSortDirection;
        if (valA > valB) return 1 * toSortDirection;
        return 0;
      });
    }
    return sorted;
  }, [filteredToMarkets, toSortColumn, toSortDirection]);

  const paginatedFromMarkets = filteredFromMarkets.slice(
    (fromPagination.currentPage - 1) * PER_PAGE,
    fromPagination.currentPage * PER_PAGE,
  );
  const paginatedToMarkets = sortedAndFilteredToMarkets.slice(
    (toPagination.currentPage - 1) * PER_PAGE,
    toPagination.currentPage * PER_PAGE,
  );

  const handleFromPaginationChange = (page: number) => {
    fromPagination.onPageChange(page);
  };

  const handleToPaginationChange = (page: number) => {
    toPagination.onPageChange(page);
  };

  return (
    <div className="flex gap-4 font-zen">
      <div className="w-2/5">
        <h3 className="mb-2 text-lg font-semibold">Your Market Positions</h3>
        <Input
          placeholder="Filter with Market ID or Collateral"
          value={fromFilter}
          onChange={(e) => onFromFilterChange(e.target.value)}
          className="mb-2"
          classNames={{
            inputWrapper: 'rounded',
          }}
        />
        <div className="relative min-h-[250px] w-full overflow-x-auto">
          {fromMarkets.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-secondary">Loading...</p>
            </div>
          ) : (
            <table className="responsive w-full rounded-md font-zen">
              <thead className="table-header bg-gray-50 text-sm dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left">Market</th>
                  <th className="px-4 py-2 text-left">Collateral / LLTV</th>
                  <th className="px-4 py-2 text-left">APY</th>
                  <th className="px-4 py-2 text-left">Supplied Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {paginatedFromMarkets.map((marketPosition) => {
                  const userConfirmedSupply = BigInt(marketPosition.state.supplyAssets);
                  const pendingDeltaBigInt = BigInt(marketPosition.pendingDelta);
                  const userNetSupply = userConfirmedSupply + pendingDeltaBigInt;

                  const rawMarketLiquidity = BigInt(marketPosition.market.state.liquidityAssets);

                  const adjustedMarketLiquidity = rawMarketLiquidity + pendingDeltaBigInt;

                  const maxTransferableAmount =
                    userNetSupply < adjustedMarketLiquidity
                      ? userNetSupply
                      : adjustedMarketLiquidity;

                  return (
                    <tr
                      key={marketPosition.market.uniqueKey}
                      onClick={() => onFromMarketSelect(marketPosition.market.uniqueKey)}
                      className={`cursor-pointer border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${
                        marketPosition.market.uniqueKey === selectedFromMarketUniqueKey
                          ? 'bg-gray-50 dark:bg-gray-800'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-monospace text-xs">
                        {marketPosition.market.uniqueKey.slice(2, 8)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-x-2">
                          <div className="flex items-center gap-1">
                            <TokenIcon
                              address={marketPosition.market.collateralAsset.address}
                              chainId={marketPosition.market.morphoBlue.chain.id}
                              symbol={marketPosition.market.collateralAsset.symbol}
                              width={18}
                              height={18}
                            />
                            <a
                              href={getAssetURL(
                                marketPosition.market.collateralAsset.address,
                                marketPosition.market.morphoBlue.chain.id,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 no-underline hover:underline"
                            >
                              {marketPosition.market.collateralAsset.symbol.length > 6
                                ? `${marketPosition.market.collateralAsset.symbol.slice(0, 6)}...`
                                : marketPosition.market.collateralAsset.symbol}
                            </a>
                          </div>
                          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {formatUnits(BigInt(marketPosition.market.lltv), 16)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {formatReadable(marketPosition.market.state.supplyApy * 100)}%
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div>
                            {formatReadable(
                              (Number(marketPosition.state.supplyAssets) +
                                Number(marketPosition.pendingDelta)) /
                                10 ** marketPosition.market.loanAsset.decimals,
                            )}{' '}
                            {marketPosition.market.loanAsset.symbol}
                          </div>

                          {/* max button */}
                          <Button
                            size="sm"
                            variant="flat"
                            className="h-5 min-w-0 px-2 text-xs"
                            isDisabled={maxTransferableAmount <= 0n}
                            onClick={(e) => {
                              e.stopPropagation();
                              onFromMarketSelect(marketPosition.market.uniqueKey);
                              if (maxTransferableAmount > 0n) {
                                onSelectMax?.(
                                  marketPosition.market.uniqueKey,
                                  Number(maxTransferableAmount),
                                );
                              }
                            }}
                          >
                            Max
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="h-12">
          {' '}
          {/* Reserve height for pagination */}
          {fromPagination.totalPages > 1 && ( // Only show pagination if more than 1 page
            <div className="mt-2 flex justify-center">
              <Pagination
                total={fromPagination.totalPages}
                page={fromPagination.currentPage}
                onChange={handleFromPaginationChange}
                color="primary"
              />
            </div>
          )}
        </div>
      </div>

      <div className="w-3/5">
        <h3 className="mb-2 text-lg font-semibold">Available Markets for Rebalancing</h3>
        <Input
          placeholder="Filter with Market ID or Collateral"
          value={toFilter}
          onChange={(e) => onToFilterChange(e.target.value)}
          className="mb-2"
          classNames={{
            inputWrapper: 'rounded',
          }}
        />
        <div className="relative min-h-[250px] w-full overflow-x-auto">
          {toMarkets.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-secondary">Loading...</p>
            </div>
          ) : (
            <table className="responsive w-full rounded-md font-zen">
              <thead className="table-header bg-gray-50 text-sm dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left">Market</th>
                  <SortableHeader
                    label="Collateral / LLTV"
                    column={ToMarketSortColumn.LLTV}
                    currentSortColumn={toSortColumn}
                    currentSortDirection={toSortDirection}
                    onClick={handleToSortChange}
                  />
                  <SortableHeader
                    label="APY"
                    column={ToMarketSortColumn.APY}
                    currentSortColumn={toSortColumn}
                    currentSortDirection={toSortDirection}
                    onClick={handleToSortChange}
                  />
                  <SortableHeader
                    label="Total Supply"
                    column={ToMarketSortColumn.TotalSupply}
                    currentSortColumn={toSortColumn}
                    currentSortDirection={toSortDirection}
                    onClick={handleToSortChange}
                  />
                  <th className="px-4 py-2 text-left">Util Rate</th>
                  <th className="px-4 py-2 text-left">Risks</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {paginatedToMarkets.map((market) => {
                  const completeMarket = eligibleMarkets.find(
                    (m) => m.uniqueKey === market.uniqueKey,
                  );
                  return (
                    <tr
                      key={market.uniqueKey}
                      onClick={() => onToMarketSelect(market.uniqueKey)}
                      className={`cursor-pointer border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${
                        market.uniqueKey === selectedToMarketUniqueKey
                          ? 'bg-gray-50 dark:bg-gray-800'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-monospace text-xs">
                        <div className="flex items-center gap-1">
                          <span>{market.uniqueKey.slice(2, 8)}</span>
                          {staredIds.includes(market.uniqueKey) && (
                            <span className="flex-shrink-0">
                              <FaStar className="text-yellow-500" />
                            </span>
                          )}
                          {fromMarkets.some((fm) => fm.market.uniqueKey === market.uniqueKey) && (
                            <Tooltip
                              content={
                                <TooltipContent detail="You have supplied to this market." />
                              }
                              className="rounded-sm"
                              placement="top"
                            >
                              <span className="flex-shrink-0 cursor-default">
                                <FaUser size={12} />
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      <td className="px-4">
                        <div className="flex items-center gap-x-2">
                          <div className="flex items-center gap-1">
                            <TokenIcon
                              address={market.collateralAsset.address}
                              chainId={market.morphoBlue.chain.id}
                              symbol={market.collateralAsset.symbol}
                              width={18}
                              height={18}
                            />
                            <a
                              href={getAssetURL(
                                market.collateralAsset.address,
                                market.morphoBlue.chain.id,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 no-underline hover:underline"
                            >
                              {market.collateralAsset.symbol.length > 6
                                ? `${market.collateralAsset.symbol.slice(0, 6)}...`
                                : market.collateralAsset.symbol}
                            </a>
                          </div>
                          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {formatUnits(BigInt(market.lltv), 16)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">{formatReadable(market.state.supplyApy * 100)}%</td>
                      <td className="px-4 py-2">
                        {formatReadable(
                          Number(market.state.supplyAssets) / 10 ** market.loanAsset.decimals,
                        )}{' '}
                        {market.loanAsset.symbol}
                      </td>
                      <td className="px-4 py-2">
                        {formatReadable(market.state.utilization * 100)}%
                      </td>
                      <td className="px-4 py-2">
                        {completeMarket && (
                          <div className="flex items-center justify-center gap-1">
                            <MarketAssetIndicator market={completeMarket} mode="complex" />
                            <MarketOracleIndicator market={completeMarket} mode="complex" />
                            <MarketDebtIndicator market={completeMarket} mode="complex" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="h-12">
          {' '}
          {/* Reserve height for pagination */}
          {toPagination.totalPages > 1 && ( // Only show pagination if more than 1 page
            <div className="mt-2 flex justify-center">
              <Pagination
                total={toPagination.totalPages}
                initialPage={toPagination.currentPage}
                onChange={handleToPaginationChange}
                color="primary"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Input } from '@nextui-org/react';
import { Pagination } from '@nextui-org/react';
import { ArrowUpIcon, ArrowDownIcon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { Market } from '@/hooks/useMarkets';
import { formatReadable } from '@/utils/balance';
import { MarketPosition } from '@/utils/types';

type MarketTablesProps = {
  fromMarkets: (MarketPosition & { pendingDelta: number })[];
  toMarkets: Market[];
  fromFilter: string;
  toFilter: string;
  onFromFilterChange: (value: string) => void;
  onToFilterChange: (value: string) => void;
  onFromMarketSelect: (marketUniqueKey: string) => void;
  onToMarketSelect: (marketUniqueKey: string) => void;
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
};

export function FromAndToMarkets({
  fromMarkets,
  toMarkets,
  fromFilter,
  toFilter,
  onFromFilterChange,
  onToFilterChange,
  onFromMarketSelect,
  onToMarketSelect,
  fromPagination,
  toPagination,
}: MarketTablesProps) {
  const filteredFromMarkets = fromMarkets.filter(
    (marketPosition) =>
      marketPosition.market.uniqueKey.toLowerCase().includes(fromFilter.toLowerCase()) ||
      marketPosition.market.collateralAsset.symbol.toLowerCase().includes(fromFilter.toLowerCase()),
  );

  const filteredToMarkets = toMarkets.filter(
    (market) =>
      market.uniqueKey.toLowerCase().includes(toFilter.toLowerCase()) ||
      market.collateralAsset.symbol.toLowerCase().includes(toFilter.toLowerCase()),
  );

  const paginatedFromMarkets = filteredFromMarkets.slice(
    (fromPagination.currentPage - 1) * 5,
    fromPagination.currentPage * 5,
  );
  const paginatedToMarkets = filteredToMarkets.slice(
    (toPagination.currentPage - 1) * 5,
    toPagination.currentPage * 5,
  );

  const handleFromPaginationChange = (page: number) => {
    fromPagination.onPageChange(page);
  };

  const handleToPaginationChange = (page: number) => {
    toPagination.onPageChange(page);
  };

  return (
    <div className="flex gap-4 font-zen">
      <div className="w-1/2">
        <h3 className="mb-2 text-lg font-semibold">Existing Positions</h3>
        <Input
          placeholder="Filter existing positions"
          value={fromFilter}
          onChange={(e) => onFromFilterChange(e.target.value)}
          className="mb-2"
        />
        <div className="w-full overflow-x-auto">
          <table className="responsive w-full rounded-md font-zen">
            <thead className="table-header bg-gray-50 text-sm dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left">Market ID</th>
                <th className="px-4 py-2 text-left">Collateral</th>
                <th className="px-4 py-2 text-left">LLTV</th>
                <th className="px-4 py-2 text-left">APY</th>
                <th className="px-4 py-2 text-left">Supplied Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedFromMarkets.map((marketPosition) => (
                <tr
                  key={marketPosition.market.uniqueKey}
                  onClick={() => onFromMarketSelect(marketPosition.market.uniqueKey)}
                  className="cursor-pointer border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <td className="px-4 py-2 font-monospace text-xs">
                    {marketPosition.market.uniqueKey.slice(2, 8)}
                  </td>
                  <td className="px-4 py-2">{marketPosition.market.collateralAsset.symbol}</td>
                  <td className="px-4 py-2">
                    {formatUnits(BigInt(marketPosition.market.lltv), 16)}%
                  </td>
                  <td className="px-4 py-2">
                    {formatReadable(marketPosition.market.dailyApys.netSupplyApy * 100)}%
                  </td>
                  <td className="px-4 py-2">
                    {formatReadable(
                      Number(marketPosition.supplyAssets) /
                        10 ** marketPosition.market.loanAsset.decimals,
                    )}{' '}
                    {marketPosition.market.loanAsset.symbol}
                    {marketPosition.pendingDelta !== 0 && (
                      <span
                        className={`ml-1 ${
                          marketPosition.pendingDelta > 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {marketPosition.pendingDelta > 0 ? (
                          <ArrowUpIcon className="inline" />
                        ) : (
                          <ArrowDownIcon className="inline" />
                        )}
                        ({formatReadable(Math.abs(marketPosition.pendingDelta))})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex justify-center">
          <Pagination
            total={fromPagination.totalPages}
            initialPage={fromPagination.currentPage}
            onChange={handleFromPaginationChange}
            color="primary"
          />
        </div>
      </div>

      <div className="w-1/2">
        <h3 className="mb-2 text-lg font-semibold">Available Markets</h3>
        <Input
          placeholder="Filter available markets"
          value={toFilter}
          onChange={(e) => onToFilterChange(e.target.value)}
          className="mb-2"
        />
        <div className="w-full overflow-x-auto">
          <table className="responsive w-full rounded-md font-zen">
            <thead className="table-header bg-gray-50 text-sm dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left">Market ID</th>
                <th className="px-4 py-2 text-left">Collateral</th>
                <th className="px-4 py-2 text-left">LLTV</th>
                <th className="px-4 py-2 text-left">APY</th>
                <th className="px-4 py-2 text-left">Total Supply</th>
                <th className="px-4 py-2 text-left">Util Rate</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedToMarkets.map((market) => (
                <tr
                  key={market.uniqueKey}
                  onClick={() => onToMarketSelect(market.uniqueKey)}
                  className="cursor-pointer border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <td className="px-4 py-2 font-monospace text-xs">
                    {market.uniqueKey.slice(2, 8)}
                  </td>
                  <td className="px-4 py-2">{market.collateralAsset.symbol}</td>
                  <td className="px-4 py-2">{formatUnits(BigInt(market.lltv), 16)}%</td>
                  <td className="px-4 py-2">{formatReadable(market.state.supplyApy * 100)}%</td>
                  <td className="px-4 py-2">
                    {formatReadable(
                      Number(market.state.supplyAssets) / 10 ** market.loanAsset.decimals,
                    )}{' '}
                    {market.loanAsset.symbol}
                  </td>
                  <td className="px-4 py-2">{formatReadable(market.state.utilization * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex justify-center">
          <Pagination
            total={toPagination.totalPages}
            initialPage={toPagination.currentPage}
            onChange={handleToPaginationChange}
            color="primary"
          />
        </div>
      </div>
    </div>
  );
}

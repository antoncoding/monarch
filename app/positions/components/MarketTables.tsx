import React from 'react';
import { Input } from "@nextui-org/react";
import { formatUnits } from 'viem';
import { formatReadable } from '@/utils/balance';
import { HTSortable } from 'app/markets/components/MarketTableUtils';
import { Pagination } from "@nextui-org/react";
import { SortColumn } from 'app/markets/components/constants';
import { MarketPosition } from '@/utils/types';
import { Market } from '@/hooks/useMarkets';
import { useTheme } from "next-themes";

type MarketTablesProps = {
  fromMarkets: MarketPosition[];
  toMarkets: Market[];
  fromFilter: string;
  toFilter: string;
  onFromFilterChange: (value: string) => void;
  onToFilterChange: (value: string) => void;
  onFromMarketSelect: (marketUniqueKey: string) => void;
  onToMarketSelect: (marketUniqueKey: string) => void;
  sortColumn: SortColumn;
  sortDirection: number;
  onSortChange: (column: SortColumn) => void;
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

export function MarketTables({
  fromMarkets,
  toMarkets,
  fromFilter,
  toFilter,
  onFromFilterChange,
  onToFilterChange,
  onFromMarketSelect,
  onToMarketSelect,
  sortColumn,
  sortDirection,
  onSortChange,
  fromPagination,
  toPagination,
}: MarketTablesProps) {
  const { theme } = useTheme();

  const filteredFromMarkets = fromMarkets.filter(marketPosition => 
    marketPosition.market.uniqueKey.toLowerCase().includes(fromFilter.toLowerCase()) ||
    marketPosition.market.collateralAsset.symbol.toLowerCase().includes(fromFilter.toLowerCase())
  );

  const filteredToMarkets = toMarkets.filter(market => 
    market.uniqueKey.toLowerCase().includes(toFilter.toLowerCase()) ||
    market.collateralAsset.symbol.toLowerCase().includes(toFilter.toLowerCase())
  );

  const paginatedFromMarkets = filteredFromMarkets.slice((fromPagination.currentPage - 1) * 5, fromPagination.currentPage * 5);
  const paginatedToMarkets = filteredToMarkets.slice((toPagination.currentPage - 1) * 5, toPagination.currentPage * 5);

  return (
    <div className="flex gap-4 font-zen">
      <div className="w-1/2">
        <h3 className="text-lg font-semibold mb-2">Existing Positions</h3>
        <Input
          placeholder="Filter existing positions"
          value={fromFilter}
          onChange={(e) => onFromFilterChange(e.target.value)}
          className="mb-2"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Market ID</th>
                <th className="px-4 py-2 text-left">Collateral</th>
                <th className="px-4 py-2 text-left">LLTV</th>
                <th className="px-4 py-2 text-left">APY</th>
                <th className="px-4 py-2 text-left">Supplied Amount</th>
                <th className="px-4 py-2 text-left">Balance</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFromMarkets.map((marketPosition) => (
                <tr 
                  key={marketPosition.market.uniqueKey} 
                  onClick={() => onFromMarketSelect(marketPosition.market.uniqueKey)}
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-2 font-monospace text-xs">{marketPosition.market.uniqueKey.slice(2, 8)}</td>
                  <td className="px-4 py-2">{marketPosition.market.collateralAsset.symbol}</td>
                  <td className="px-4 py-2">{formatUnits(BigInt(marketPosition.market.lltv), 16)}%</td>
                  <td className="px-4 py-2">{formatReadable(marketPosition.market.dailyApys.netSupplyApy * 100)}%</td>
                  <td className="px-4 py-2">
                    {formatReadable(Number(marketPosition.supplyAssets) / 10 ** marketPosition.market.loanAsset.decimals)}{' '}
                    {marketPosition.market.loanAsset.symbol}
                  </td>
                  <td className="px-4 py-2">
                    {formatReadable(Number(marketPosition.market.state.supplyAssets) / 10 ** marketPosition.market.loanAsset.decimals)}{' '}
                    {marketPosition.market.loanAsset.symbol}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-2">
          <Pagination
            total={fromPagination.totalPages}
            initialPage={fromPagination.currentPage}
            onChange={fromPagination.onPageChange}
          />
        </div>
      </div>

      <div className="w-1/2">
        <h3 className="text-lg font-semibold mb-2">Available Markets</h3>
        <Input
          placeholder="Filter available markets"
          value={toFilter}
          onChange={(e) => onToFilterChange(e.target.value)}
          className="mb-2"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Market ID</th>
                <th className="px-4 py-2 text-left">Collateral</th>
                <th className="px-4 py-2 text-left">
                  <HTSortable
                    label="LLTV"
                    sortColumn={sortColumn}
                    titleOnclick={onSortChange}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.LLTV}
                  />
                </th>
                <th className="px-4 py-2 text-left">
                  <HTSortable
                    label="APY"
                    sortColumn={sortColumn}
                    titleOnclick={onSortChange}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.SupplyAPY}
                  />
                </th>
                <th className="px-4 py-2 text-left">Total Supply</th>
                <th className="px-4 py-2 text-left">Util Rate</th>
              </tr>
            </thead>
            <tbody>
              {paginatedToMarkets.map((market) => (
                <tr 
                  key={market.uniqueKey} 
                  onClick={() => onToMarketSelect(market.uniqueKey)}
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-2 font-monospace text-xs">{market.uniqueKey.slice(2, 8)}</td>
                  <td className="px-4 py-2">{market.collateralAsset.symbol}</td>
                  <td className="px-4 py-2">{formatUnits(BigInt(market.lltv), 16)}%</td>
                  <td className="px-4 py-2">{formatReadable(market.state.supplyApy * 100)}%</td>
                  <td className="px-4 py-2">
                    {formatReadable(Number(market.state.supplyAssets) / 10 ** market.loanAsset.decimals)} {market.loanAsset.symbol}
                  </td>
                  <td className="px-4 py-2">{formatReadable(market.state.utilization * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-2">
          <Pagination
            total={toPagination.totalPages}
            initialPage={toPagination.currentPage}
            onChange={toPagination.onPageChange}
          />
        </div>
      </div>
    </div>
  );
}
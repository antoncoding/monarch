import React from 'react';
import { Input } from '@nextui-org/react';
import { Pagination } from '@nextui-org/react';
import { ArrowUpIcon, ArrowDownIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { formatUnits } from 'viem';
import { Market } from '@/hooks/useMarkets';
import { formatReadable } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { findToken } from '@/utils/tokens';
import { MarketPosition } from '@/utils/types';
import {
  MarketAssetIndicator,
  MarketOracleIndicator,
  MarketDebtIndicator,
} from '../../markets/components/RiskIndicator';

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
  fromPagination,
  toPagination,
  selectedFromMarketUniqueKey,
  selectedToMarketUniqueKey,
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
      <div className="w-2/5">
        <h3 className="mb-2 text-lg font-semibold">Your Market Positions</h3>
        <Input
          placeholder="Filter your positions or Market ID"
          value={fromFilter}
          onChange={(e) => onFromFilterChange(e.target.value)}
          className="mb-2"
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
                  <th className="px-4 py-2 text-left">Market ID</th>
                  <th className="px-4 py-2 text-left">Collateral</th>
                  <th className="px-4 py-2 text-left">LLTV</th>
                  <th className="px-4 py-2 text-left">APY</th>
                  <th className="px-4 py-2 text-left">Supplied Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {paginatedFromMarkets.map((marketPosition) => {
                  const collateralToken = findToken(
                    marketPosition.market.collateralAsset.address,
                    marketPosition.market.morphoBlue.chain.id,
                  );
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
                        <div className="flex items-center gap-1">
                          {collateralToken?.img && (
                            <Image
                              src={collateralToken.img}
                              alt={marketPosition.market.collateralAsset.symbol}
                              width={18}
                              height={18}
                            />
                          )}
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
                            {marketPosition.market.collateralAsset.symbol}
                          </a>
                        </div>
                      </td>
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
                            (
                            {formatReadable(
                              Math.abs(
                                Number(
                                  formatUnits(
                                    BigInt(marketPosition.pendingDelta),
                                    marketPosition.market.loanAsset.decimals,
                                  ),
                                ),
                              ),
                            )}
                            )
                          </span>
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
          placeholder="Filter available markets or Market ID"
          value={toFilter}
          onChange={(e) => onToFilterChange(e.target.value)}
          className="mb-2"
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
                  <th className="px-4 py-2 text-left">Collateral</th>
                  <th className="px-4 py-2 text-left">LLTV</th>
                  <th className="px-4 py-2 text-left">APY</th>
                  <th className="px-4 py-2 text-left">Total Supply</th>
                  <th className="px-4 py-2 text-left">Util Rate</th>
                  <th className="px-4 py-2 text-left">Risks</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {paginatedToMarkets.map((market) => {
                  const collateralToken = findToken(
                    market.collateralAsset.address,
                    market.morphoBlue.chain.id,
                  );
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
                        {market.uniqueKey.slice(2, 8)}
                      </td>
                      <td className="px-4">
                        <div className="flex items-center gap-1">
                          {collateralToken?.img && (
                            <Image
                              src={collateralToken.img}
                              alt={market.collateralAsset.symbol}
                              width={18}
                              height={18}
                            />
                          )}
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
                            {market.collateralAsset.symbol}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-2">{formatUnits(BigInt(market.lltv), 16)}%</td>
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
                            <MarketAssetIndicator market={completeMarket} />
                            <MarketOracleIndicator market={completeMarket} />
                            <MarketDebtIndicator market={completeMarket} />
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

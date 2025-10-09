import React, { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getTruncatedAssetName } from '@/utils/oracle';
import { Market } from '@/utils/types';
import OracleVendorBadge from '../OracleVendorBadge';
import { TokenIcon } from '../TokenIcon';

type MarketCapState = {
  market: Market;
  relativeCap: string;
  absoluteCap: string;
  isSelected: boolean;
};

type MarketCapTableProps = {
  markets: MarketCapState[];
  onToggleMarket: (marketId: string) => void;
  onRelativeCapChange: (marketId: string, value: string) => void;
  disabled?: boolean;
  collateralFilter: string[];
  onCollateralFilterChange: (collaterals: string[]) => void;
};

const ITEMS_PER_PAGE = 10;

export function MarketCapTable({
  markets,
  onToggleMarket,
  onRelativeCapChange,
  disabled = false,
  collateralFilter,
  onCollateralFilterChange,
}: MarketCapTableProps): JSX.Element {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique collaterals for filter
  const availableCollaterals = useMemo(() => {
    const collaterals = new Set<string>();
    markets.forEach((m) => collaterals.add(m.market.collateralAsset.symbol));
    return Array.from(collaterals).sort();
  }, [markets]);

  // Filter markets
  const filteredMarkets = useMemo(() => {
    let filtered = markets;

    // Apply collateral filter
    if (collateralFilter.length > 0) {
      filtered = filtered.filter((m) =>
        collateralFilter.includes(m.market.collateralAsset.symbol),
      );
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.market.collateralAsset.symbol.toLowerCase().includes(query) ||
          m.market.uniqueKey.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [markets, collateralFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMarkets = filteredMarkets.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [collateralFilter, searchQuery]);

  const handleCapChange = (marketId: string, value: string) => {
    // Allow empty or valid decimal numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const numValue = parseFloat(value);
      if (value === '' || (numValue >= 0 && numValue <= 100)) {
        onRelativeCapChange(marketId, value);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by collateral or market ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded border border-gray-200 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700"
        />
        <select
          value={collateralFilter.length === 1 ? collateralFilter[0] : ''}
          onChange={(e) => {
            const value = e.target.value;
            onCollateralFilterChange(value ? [value] : []);
          }}
          className="rounded border border-gray-200 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700"
        >
          <option value="">All Collaterals ({availableCollaterals.length})</option>
          {availableCollaterals.map((collateral) => (
            <option key={collateral} value={collateral}>
              {collateral}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded"
                  disabled
                  style={{ visibility: 'hidden' }}
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-secondary">
                Collateral
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-secondary">
                Oracle
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase text-secondary">
                LTV
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase text-secondary">
                APY
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase text-secondary">
                Liquidity
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase text-secondary">
                Max %
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedMarkets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-secondary">
                  No markets found
                </td>
              </tr>
            ) : (
              paginatedMarkets.map((capState) => (
                <tr
                  key={capState.market.uniqueKey}
                  className={`border-b border-gray-100 transition-colors last:border-0 dark:border-gray-700 ${
                    capState.isSelected
                      ? 'bg-primary/5 dark:bg-primary/10'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={capState.isSelected}
                      onChange={() => onToggleMarket(capState.market.uniqueKey)}
                      disabled={disabled}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary dark:border-gray-600"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <TokenIcon
                        address={capState.market.collateralAsset.address}
                        chainId={capState.market.morphoBlue.chain.id}
                        symbol={capState.market.collateralAsset.symbol}
                        width={20}
                        height={20}
                      />
                      <span className="font-medium">
                        {getTruncatedAssetName(capState.market.collateralAsset.symbol)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <OracleVendorBadge
                      oracleData={capState.market.oracle?.data}
                      showText
                      useTooltip={false}
                      chainId={capState.market.morphoBlue.chain.id}
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                      {formatUnits(BigInt(capState.market.lltv), 16)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    {capState.market.state?.supplyApy
                      ? `${(capState.market.state.supplyApy * 100).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-secondary">
                    {formatReadable(
                      formatBalance(
                        capState.market.state.liquidityAssets,
                        capState.market.loanAsset.decimals,
                      ),
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {capState.isSelected ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          value={capState.relativeCap || '100'}
                          onChange={(e) =>
                            handleCapChange(capState.market.uniqueKey, e.target.value)
                          }
                          placeholder="100"
                          disabled={disabled}
                          className="w-16 rounded border border-gray-200 bg-background px-2 py-1 text-right text-sm focus:border-primary focus:outline-none dark:border-gray-700"
                        />
                        <span className="text-xs text-secondary">%</span>
                      </div>
                    ) : (
                      <div className="text-right text-secondary">—</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-secondary">
          <div>
            Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredMarkets.length)}{' '}
            of {filteredMarkets.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

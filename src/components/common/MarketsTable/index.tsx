import React, { useMemo, useState, useEffect } from 'react';
import { Input } from '@heroui/react';
import { GearIcon } from '@radix-ui/react-icons';
import { FaSearch } from 'react-icons/fa';
import { Button } from '@/components/common';
import { SuppliedAssetFilterCompactSwitch } from '@/components/common/SuppliedAssetFilterCompactSwitch';
import TrustedVaultsModal from '@/components/settings/TrustedVaultsModal';
import { useMarkets } from '@/hooks/useMarkets';
import {
  useAvailableCollaterals,
  useAvailableOracles,
  useProcessedMarkets,
  usePaginatedMarkets,
} from '@/hooks/useMarketTableData';
import {
  useTableFilters,
  useTableSorting,
  useTableUsdFilters,
  useTableColumnVisibility,
  useTableTrustedVaults,
  useTablePagination,
} from '@/store/marketTableStore';
import { parseNumericThreshold } from '@/utils/markets';
import { calculateEmptyStateColumns } from '@/utils/marketTableHelpers';
import { ERC20Token, UnknownERC20Token } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { buildTrustedVaultMap } from '@/utils/vaults';
import MarketSettingsModal from 'app/markets/components/MarketSettingsModal';
import { Pagination } from 'app/markets/components/Pagination';
import { MarketTableCart } from './MarketTableCart';
import { CollateralFilter, OracleFilter } from './MarketTableFilters';
import { MarketTableHeader } from './MarketTableHeader';
import { MarketTableRow, MarketWithSelection } from './MarketTableRow';

type MarketsTableWithSameLoanAssetProps = {
  markets: MarketWithSelection[];
  onToggleMarket: (marketId: string) => void;
  disabled?: boolean;
  renderCartItemExtra?: (market: Market) => React.ReactNode;
  uniqueCollateralTokens?: (ERC20Token | UnknownERC20Token)[];
  showSelectColumn?: boolean;
  showCart?: boolean;
  showSettings?: boolean;
};

export function MarketsTableWithSameLoanAsset({
  markets,
  onToggleMarket,
  disabled = false,
  renderCartItemExtra,
  uniqueCollateralTokens,
  showSelectColumn = true,
  showCart = true,
  showSettings = true,
}: MarketsTableWithSameLoanAssetProps): JSX.Element {
  // Global market settings
  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useMarkets();

  // Zustand store selectors
  const {
    searchQuery,
    setSearchQuery,
    collateralFilter,
    setCollateralFilter,
    oracleFilter,
    setOracleFilter,
    includeUnknownTokens,
    setIncludeUnknownTokens,
    showUnknownOracle,
    setShowUnknownOracle,
    trustedVaultsOnly,
    setTrustedVaultsOnly,
  } = useTableFilters();

  const { sortColumn, sortDirection, handleSort } = useTableSorting();

  const {
    usdMinSupply,
    usdMinBorrow,
    usdMinLiquidity,
    setUsdMinSupply,
    setUsdMinBorrow,
    setUsdMinLiquidity,
    minSupplyEnabled,
    setMinSupplyEnabled,
    minBorrowEnabled,
    setMinBorrowEnabled,
    minLiquidityEnabled,
    setMinLiquidityEnabled,
  } = useTableUsdFilters();

  const { columnVisibility, setColumnVisibility } = useTableColumnVisibility();
  const { userTrustedVaults, setUserTrustedVaults } = useTableTrustedVaults();
  const { currentPage, setCurrentPage, entriesPerPage, setEntriesPerPage } = useTablePagination();

  // Local modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTrustedVaultsModal, setShowTrustedVaultsModal] = useState(false);

  // Get available options for filters
  const availableCollaterals = useAvailableCollaterals(markets, uniqueCollateralTokens);
  const availableOracles = useAvailableOracles(markets);

  // Process markets (filter and sort)
  const processedMarkets = useProcessedMarkets(markets);

  // Paginate markets
  const { paginatedMarkets, totalPages, safePage, safePerPage } = usePaginatedMarkets(processedMarkets);

  // Get selected markets
  const selectedMarkets = useMemo(() => {
    return markets.filter((m) => m.isSelected);
  }, [markets]);

  // Build trusted vault map
  const trustedVaultMap = useMemo(() => {
    return buildTrustedVaultMap(userTrustedVaults);
  }, [userTrustedVaults]);

  // Create USD filters object for settings modal
  const usdFilters = useMemo(
    () => ({
      minSupply: usdMinSupply,
      minBorrow: usdMinBorrow,
      minLiquidity: usdMinLiquidity,
    }),
    [usdMinSupply, usdMinBorrow, usdMinLiquidity],
  );

  const setUsdFilters = (filters: { minSupply: string; minBorrow: string; minLiquidity: string }) => {
    setUsdMinSupply(filters.minSupply);
    setUsdMinBorrow(filters.minBorrow);
    setUsdMinLiquidity(filters.minLiquidity);
  };

  const effectiveMinSupply = parseNumericThreshold(usdFilters.minSupply);
  const effectiveMinBorrow = parseNumericThreshold(usdFilters.minBorrow);
  const effectiveMinLiquidity = parseNumericThreshold(usdFilters.minLiquidity);

  const emptyStateColumns = calculateEmptyStateColumns(showSelectColumn, columnVisibility);

  // Clamp currentPage when totalPages changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage, setCurrentPage]);

  return (
    <div className="space-y-3">
      {/* Cart/Staging Area */}
      {showCart && (
        <MarketTableCart
          selectedMarkets={selectedMarkets}
          onToggleMarket={onToggleMarket}
          disabled={disabled}
          renderCartItemExtra={renderCartItemExtra}
        />
      )}

      {/* Search and Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-grow">
          <Input
            placeholder="Search by collateral symbol or market ID..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            endContent={<FaSearch className="text-secondary" />}
            classNames={{
              inputWrapper: 'bg-surface rounded-sm focus-within:outline-none',
              input: 'bg-surface rounded-sm text-xs focus:outline-none',
            }}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <SuppliedAssetFilterCompactSwitch
            includeUnknownTokens={includeUnknownTokens}
            setIncludeUnknownTokens={setIncludeUnknownTokens}
            showUnknownOracle={showUnknownOracle}
            setShowUnknownOracle={setShowUnknownOracle}
            showUnwhitelistedMarkets={showUnwhitelistedMarkets}
            setShowUnwhitelistedMarkets={setShowUnwhitelistedMarkets}
            trustedVaultsOnly={trustedVaultsOnly}
            setTrustedVaultsOnly={setTrustedVaultsOnly}
            minSupplyEnabled={minSupplyEnabled}
            setMinSupplyEnabled={setMinSupplyEnabled}
            minBorrowEnabled={minBorrowEnabled}
            setMinBorrowEnabled={setMinBorrowEnabled}
            minLiquidityEnabled={minLiquidityEnabled}
            setMinLiquidityEnabled={setMinLiquidityEnabled}
            thresholds={{
              minSupply: effectiveMinSupply,
              minBorrow: effectiveMinBorrow,
              minLiquidity: effectiveMinLiquidity,
            }}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
          {showSettings && (
            <Button
              variant="light"
              size="sm"
              onPress={() => setShowSettingsModal(true)}
              className="min-w-0 px-2"
            >
              <GearIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <CollateralFilter
          selectedCollaterals={collateralFilter}
          setSelectedCollaterals={setCollateralFilter}
          availableCollaterals={availableCollaterals}
        />
        <OracleFilter
          selectedOracles={oracleFilter}
          setSelectedOracles={setOracleFilter}
          availableOracles={availableOracles}
        />
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="responsive rounded-md font-zen text-sm">
          <MarketTableHeader
            showSelectColumn={showSelectColumn}
            columnVisibility={columnVisibility}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <tbody>
            {paginatedMarkets.length === 0 ? (
              <tr>
                <td colSpan={emptyStateColumns} className="py-8 text-center text-secondary">
                  No markets found
                </td>
              </tr>
            ) : (
              paginatedMarkets.map((marketWithSelection) => (
                <MarketTableRow
                  key={marketWithSelection.market.uniqueKey}
                  marketWithSelection={marketWithSelection}
                  onToggle={() => onToggleMarket(marketWithSelection.market.uniqueKey)}
                  disabled={disabled}
                  showSelectColumn={showSelectColumn}
                  columnVisibility={columnVisibility}
                  trustedVaultMap={trustedVaultMap}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        totalPages={totalPages}
        currentPage={safePage}
        onPageChange={setCurrentPage}
        entriesPerPage={safePerPage}
        isDataLoaded
        size="sm"
      />

      {/* Settings Modal */}
      {showSettingsModal && (
        <MarketSettingsModal
          isOpen={showSettingsModal}
          onOpenChange={setShowSettingsModal}
          usdFilters={usdFilters}
          setUsdFilters={setUsdFilters}
          entriesPerPage={entriesPerPage}
          onEntriesPerPageChange={setEntriesPerPage}
          columnVisibility={columnVisibility}
          setColumnVisibility={setColumnVisibility}
          trustedVaults={userTrustedVaults}
          onOpenTrustedVaultsModal={() => setShowTrustedVaultsModal(true)}
        />
      )}

      {/* Trusted Vaults Modal */}
      {showTrustedVaultsModal && (
        <TrustedVaultsModal
          isOpen={showTrustedVaultsModal}
          onOpenChange={setShowTrustedVaultsModal}
          userTrustedVaults={userTrustedVaults}
          setUserTrustedVaults={(vaults) => {
            // Wrap Zustand setter to handle both direct values and updater functions
            if (typeof vaults === 'function') {
              setUserTrustedVaults(vaults(userTrustedVaults));
            } else {
              setUserTrustedVaults(vaults);
            }
          }}
        />
      )}
    </div>
  );
}

// Re-export types and components
export type { MarketWithSelection } from './MarketTableRow';
export { SortColumn } from '@/store/marketTableStore';

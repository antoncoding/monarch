import React, { useMemo, useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowDownIcon, ArrowUpIcon, GearIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { ExpandableSearchInput } from '@/features/markets/components/filters/expandable-search-input';
import EmptyScreen from '@/components/status/empty-screen';
import AssetFilter from '@/features/markets/components/filters/asset-filter';
import OracleFilter from '@/features/markets/components/filters/oracle-filter';
import { MarketFilter } from '@/features/positions/components/markets-filter-compact';
import { ClearFiltersButton } from '@/components/shared/clear-filters-button';
import { TablePagination } from '@/components/shared/table-pagination';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { TrustedByCell } from '@/features/autovault/components/trusted-vault-badges';
import { getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useFreshMarketsState } from '@/hooks/useFreshMarketsState';
import { useModal } from '@/hooks/useModal';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance, formatReadable } from '@/utils/balance';
import { filterMarkets, sortMarkets, createPropertySort } from '@/utils/marketFilters';
import { getViemChain } from '@/utils/networks';
import { parsePriceFeedVendors, type PriceFeedVendors } from '@/utils/oracle';
import { convertApyToApr } from '@/utils/rateMath';
import { type ERC20Token, type UnknownERC20Token, infoToKey } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { buildTrustedVaultMap } from '@/utils/vaults';
import { MarketIdBadge } from './market-id-badge';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from './market-identity';
import { MarketIndicators } from './market-indicators';

const ZERO_DISPLAY_THRESHOLD = 1e-6;

function formatAmountDisplay(value: bigint | string, decimals: number) {
  const numericValue = formatBalance(value, decimals);
  if (!Number.isFinite(numericValue) || Math.abs(numericValue) < ZERO_DISPLAY_THRESHOLD) {
    return '-';
  }
  return formatReadable(numericValue);
}

export type MarketWithSelection = {
  market: Market;
  isSelected: boolean;
};

type MarketsTableWithSameLoanAssetProps = {
  markets: MarketWithSelection[];
  onToggleMarket: (marketId: string) => void;
  disabled?: boolean;
  // Optional: Pass unique tokens for better filter performance
  uniqueCollateralTokens?: ERC20Token[];
  // Optional: Hide the select column (useful for single-select mode)
  showSelectColumn?: boolean;
};

enum SortColumn {
  COLLATSYMBOL = 0,
  Supply = 1,
  APY = 2,
  Liquidity = 3,
  Borrow = 4,
  BorrowAPY = 5,
  RateAtTarget = 6,
  Risk = 7,
  TrustedBy = 8,
  UtilizationRate = 9,
}

function getTrustedVaultsForMarket(market: Market, trustedVaultMap: Map<string, TrustedVault>): TrustedVault[] {
  if (!market.supplyingVaults?.length) {
    return [];
  }

  const chainId = market.morphoBlue.chain.id;
  const seen = new Set<string>();
  const matches: TrustedVault[] = [];

  market.supplyingVaults.forEach((vault) => {
    if (!vault.address) return;
    const key = getVaultKey(vault.address, chainId);
    if (seen.has(key)) return;
    seen.add(key);
    const trusted = trustedVaultMap.get(key);
    if (trusted) {
      matches.push(trusted);
    }
  });

  return matches.sort((a, b) => {
    const aUnknown = a.curator === 'unknown';
    const bUnknown = b.curator === 'unknown';
    if (aUnknown !== bUnknown) {
      return aUnknown ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
}

function HTSortable({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: 1 | -1;
  onSort: (column: SortColumn) => void;
}) {
  const isSorting = sortColumn === column;
  return (
    <th
      className={`cursor-pointer select-none text-center font-normal px-2 py-2 ${isSorting ? 'text-primary' : ''}`}
      onClick={() => onSort(column)}
      style={{ padding: '0.5rem', paddingTop: '1rem', paddingBottom: '1rem' }}
    >
      <div className="flex items-center justify-center gap-1">
        <div>{label}</div>
        {isSorting && (sortDirection === 1 ? <ArrowDownIcon /> : <ArrowUpIcon />)}
      </div>
    </th>
  );
}

function MarketRow({
  marketWithSelection,
  onToggle,
  disabled,
  showSelectColumn,
  trustedVaultMap,
  supplyRateLabel,
  borrowRateLabel,
  isAprDisplay,
}: {
  marketWithSelection: MarketWithSelection;
  onToggle: () => void;
  disabled: boolean;
  showSelectColumn: boolean;
  trustedVaultMap: Map<string, TrustedVault>;
  supplyRateLabel: string;
  borrowRateLabel: string;
  isAprDisplay: boolean;
}) {
  const { columnVisibility } = useMarketPreferences();

  const { market, isSelected } = marketWithSelection;
  const trustedVaults = useMemo(() => {
    if (!columnVisibility.trustedBy) {
      return [];
    }
    return getTrustedVaultsForMarket(market, trustedVaultMap);
  }, [columnVisibility.trustedBy, market, trustedVaultMap]);

  return (
    <tr
      className={`cursor-pointer transition-colors hover:bg-surface-dark ${isSelected ? 'bg-primary/5' : ''}`}
      onClick={(e) => {
        // Don't toggle if clicking on input
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          onToggle();
        }
      }}
    >
      {showSelectColumn && (
        <td className="z-50 py-1">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onToggle()}
              disabled={disabled}
              className="cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      )}
      <td
        className="z-50 py-1 text-center"
        style={{ minWidth: '80px' }}
      >
        <MarketIdBadge
          marketId={market.uniqueKey}
          chainId={market.morphoBlue.chain.id}
        />
      </td>
      <td
        className="z-50 py-1 pl-4"
        style={{ minWidth: '240px' }}
      >
        <MarketIdentity
          market={market}
          chainId={market.morphoBlue.chain.id}
          mode={MarketIdentityMode.Minimum}
          focus={MarketIdentityFocus.Collateral}
          showLltv
          showOracle
          iconSize={20}
          showExplorerLink={false}
        />
      </td>
      {columnVisibility.trustedBy && (
        <td
          data-label="Trusted By"
          className="z-50 py-1 text-center"
          style={{ minWidth: '110px' }}
        >
          <TrustedByCell vaults={trustedVaults} />
        </td>
      )}
      {columnVisibility.totalSupply && (
        <td
          data-label="Total Supply"
          className="z-50 py-1 text-center"
          style={{ minWidth: '120px' }}
        >
          <p className="text-xs">{formatAmountDisplay(market.state.supplyAssets, market.loanAsset.decimals)}</p>
        </td>
      )}
      {columnVisibility.totalBorrow && (
        <td
          data-label="Total Borrow"
          className="z-50 py-1 text-center"
          style={{ minWidth: '120px' }}
        >
          <p className="text-xs">{formatAmountDisplay(market.state.borrowAssets, market.loanAsset.decimals)}</p>
        </td>
      )}
      {columnVisibility.liquidity && (
        <td
          data-label="Liquidity"
          className="z-50 py-1 text-center"
          style={{ minWidth: '120px' }}
        >
          <p className="text-xs">{formatAmountDisplay(market.state.liquidityAssets, market.loanAsset.decimals)}</p>
        </td>
      )}
      {columnVisibility.supplyAPY && (
        <td
          data-label={supplyRateLabel}
          className="z-50 py-1 text-center"
          style={{ minWidth: '100px' }}
        >
          <div className="flex items-center justify-center">
            <p className="text-sm">
              {market.state.supplyApy
                ? `${((isAprDisplay ? convertApyToApr(market.state.supplyApy) : market.state.supplyApy) * 100).toFixed(2)}`
                : '—'}
            </p>
            {market.state.supplyApy && <span className="text-xs ml-0.5"> % </span>}
          </div>
        </td>
      )}
      {columnVisibility.borrowAPY && (
        <td
          data-label={borrowRateLabel}
          className="z-50 py-1 text-center"
          style={{ minWidth: '100px' }}
        >
          <p className="text-sm">
            {market.state.borrowApy
              ? `${((isAprDisplay ? convertApyToApr(market.state.borrowApy) : market.state.borrowApy) * 100).toFixed(2)}%`
              : '—'}
          </p>
        </td>
      )}
      {columnVisibility.rateAtTarget && (
        <td
          data-label="Target Rate"
          className="z-50 py-1 text-center"
          style={{ minWidth: '110px' }}
        >
          <p className="text-sm">
            {market.state.apyAtTarget
              ? `${((isAprDisplay ? convertApyToApr(market.state.apyAtTarget) : market.state.apyAtTarget) * 100).toFixed(2)}%`
              : '—'}
          </p>
        </td>
      )}
      {columnVisibility.utilizationRate && (
        <td
          data-label="Utilization"
          className="z-50 py-1 text-center"
          style={{ minWidth: '100px' }}
        >
          <p className="text-sm">{`${(market.state.utilization * 100).toFixed(2)}%`}</p>
        </td>
      )}
      <td
        data-label="Indicators"
        className="z-50 py-1 text-center"
        style={{ minWidth: '100px' }}
      >
        <MarketIndicators
          market={market}
          showRisk
        />
      </td>
    </tr>
  );
}

export function MarketsTableWithSameLoanAsset({
  markets,
  onToggleMarket,
  disabled = false,
  uniqueCollateralTokens,
  showSelectColumn = true,
}: MarketsTableWithSameLoanAssetProps): JSX.Element {
  // Get global market settings
  const { showUnwhitelistedMarkets, isAprDisplay } = useAppSettings();
  const { findToken } = useTokensQuery();
  const { label: supplyRateLabel } = useRateLabel({ prefix: 'Supply' });
  const { label: borrowRateLabel } = useRateLabel({ prefix: 'Borrow' });

  // Extract just the Market objects for fresh fetching
  const marketsList = useMemo(() => markets.map((m) => m.market), [markets]);

  // Fetch fresh market state from RPC to get current liquidity/supply data
  const { markets: freshMarketsList } = useFreshMarketsState(marketsList);

  // Merge fresh market data back into MarketWithSelection
  const marketsWithFreshState = useMemo(() => {
    if (!freshMarketsList) return markets;

    return markets.map((m) => {
      const freshMarket = freshMarketsList.find((fm) => fm.uniqueKey === m.market.uniqueKey);
      return freshMarket ? { ...m, market: freshMarket } : m;
    });
  }, [markets, freshMarketsList]);

  const { open: openModal } = useModal();

  // Table state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>(SortColumn.Supply);
  const [sortDirection, setSortDirection] = useState<1 | -1>(-1); // -1 = desc, 1 = asc
  const [collateralFilter, setCollateralFilter] = useState<string[]>([]);
  const [oracleFilter, setOracleFilter] = useState<PriceFeedVendors[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings state from Zustand store
  const {
    entriesPerPage,
    includeUnknownTokens,
    showUnknownOracle,
    trustedVaultsOnly,
    usdMinSupply,
    usdMinBorrow,
    usdMinLiquidity,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
    columnVisibility,
  } = useMarketPreferences();

  const { vaults: userTrustedVaults } = useTrustedVaults();

  const trustedVaultMap = useMemo(() => {
    return buildTrustedVaultMap(userTrustedVaults);
  }, [userTrustedVaults]);

  const hasTrustedVault = useCallback(
    (market: Market) => {
      if (!market.supplyingVaults?.length) return false;
      const chainId = market.morphoBlue.chain.id;
      return market.supplyingVaults.some((vault) => {
        if (!vault.address) return false;
        return trustedVaultMap.has(getVaultKey(vault.address as string, chainId));
      });
    },
    [trustedVaultMap],
  );

  // Create memoized usdFilters object from individual localStorage values
  const usdFilters = useMemo(
    () => ({
      minSupply: usdMinSupply,
      minBorrow: usdMinBorrow,
      minLiquidity: usdMinLiquidity,
    }),
    [usdMinSupply, usdMinBorrow, usdMinLiquidity],
  );

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 1 ? -1 : 1));
    } else {
      setSortColumn(column);
      setSortDirection(-1);
    }
  };

  // Get unique collaterals with full token data
  const availableCollaterals = useMemo(() => {
    if (uniqueCollateralTokens) {
      return [...uniqueCollateralTokens].sort(
        (a, b) => (a.source === 'local' ? 0 : 1) - (b.source === 'local' ? 0 : 1) || a.symbol.localeCompare(b.symbol),
      );
    }

    // Fallback: build tokens manually from markets
    const tokenMap = new Map<string, ERC20Token | UnknownERC20Token>();

    markets.forEach((m) => {
      // Add null checks for nested properties
      if (!m?.market?.collateralAsset?.address || !m?.market?.morphoBlue?.chain?.id) {
        return;
      }

      const key = infoToKey(m.market.collateralAsset.address, m.market.morphoBlue.chain.id);

      if (!tokenMap.has(key)) {
        // Check if token exists in supportedTokens
        const existingToken = findToken(m.market.collateralAsset.address, m.market.morphoBlue.chain.id);

        if (existingToken) {
          tokenMap.set(key, existingToken);
        } else {
          const token: UnknownERC20Token = {
            symbol: m.market.collateralAsset.symbol ?? 'Unknown',
            img: undefined,
            decimals: m.market.collateralAsset.decimals ?? 18,
            networks: [
              {
                address: m.market.collateralAsset.address,
                chain: getViemChain(m.market.morphoBlue.chain.id),
              },
            ],
            isUnknown: true,
            source: 'unknown',
          };
          tokenMap.set(key, token);
        }
      }
    });

    return Array.from(tokenMap.values()).sort(
      (a, b) => (a.source === 'local' ? 0 : 1) - (b.source === 'local' ? 0 : 1) || a.symbol.localeCompare(b.symbol),
    );
  }, [markets, uniqueCollateralTokens, findToken]);

  // Get unique oracles from current markets
  const availableOracles = useMemo(() => {
    const oracleSet = new Set<PriceFeedVendors>();

    markets.forEach((m) => {
      if (!m?.market?.morphoBlue?.chain?.id) return;
      const vendorInfo = parsePriceFeedVendors(m.market.oracle?.data, m.market.morphoBlue.chain.id);
      if (vendorInfo?.coreVendors) {
        vendorInfo.coreVendors.forEach((vendor) => oracleSet.add(vendor));
      }
    });

    return Array.from(oracleSet);
  }, [markets]);

  // Filter and sort markets using the new shared filtering system
  const processedMarkets = useMemo(() => {
    // Extract just the markets for filtering (using fresh state)
    const marketsListForFilter = marketsWithFreshState.map((m) => m.market);

    // Apply global filters using the shared utility
    let filtered = filterMarkets(marketsListForFilter, {
      showUnknownTokens: includeUnknownTokens,
      showUnknownOracle,
      selectedCollaterals: collateralFilter,
      selectedOracles: oracleFilter,
      usdFilters: {
        minSupply: {
          enabled: minSupplyEnabled,
          threshold: usdFilters.minSupply,
        },
        minBorrow: {
          enabled: minBorrowEnabled,
          threshold: usdFilters.minBorrow,
        },
        minLiquidity: {
          enabled: minLiquidityEnabled,
          threshold: usdFilters.minLiquidity,
        },
      },
      findToken,
      searchQuery,
    });

    // Apply whitelist filter (not in the shared utility because it uses global state)
    if (!showUnwhitelistedMarkets) {
      filtered = filtered.filter((market) => market.whitelisted ?? false);
    }

    if (trustedVaultsOnly) {
      filtered = filtered.filter(hasTrustedVault);
    }

    // Sort using the shared utility
    const sortPropertyMap: Record<SortColumn, string> = {
      [SortColumn.COLLATSYMBOL]: 'collateralAsset.symbol',
      [SortColumn.Supply]: 'state.supplyAssetsUsd',
      [SortColumn.APY]: 'state.supplyApy',
      [SortColumn.Liquidity]: 'state.liquidityAssets',
      [SortColumn.Borrow]: 'state.borrowAssetsUsd',
      [SortColumn.BorrowAPY]: 'state.borrowApy',
      [SortColumn.RateAtTarget]: 'state.apyAtTarget',
      [SortColumn.Risk]: '', // No sorting for risk
      [SortColumn.TrustedBy]: '',
      [SortColumn.UtilizationRate]: 'state.utilization',
    };

    const propertyPath = sortPropertyMap[sortColumn];
    if (sortColumn === SortColumn.TrustedBy) {
      filtered = sortMarkets(filtered, (a, b) => Number(hasTrustedVault(a)) - Number(hasTrustedVault(b)), sortDirection);
    } else if (propertyPath && sortColumn !== SortColumn.Risk) {
      filtered = sortMarkets(filtered, createPropertySort(propertyPath), sortDirection);
    }

    // Map back to MarketWithSelection
    return filtered.map((market) => {
      const original = marketsWithFreshState.find((m) => m.market.uniqueKey === market.uniqueKey);
      return original ?? { market, isSelected: false };
    });
  }, [
    marketsWithFreshState,
    collateralFilter,
    oracleFilter,
    sortColumn,
    sortDirection,
    searchQuery,
    showUnwhitelistedMarkets,
    includeUnknownTokens,
    showUnknownOracle,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
    usdFilters,
    findToken,
    hasTrustedVault,
    trustedVaultsOnly,
  ]);

  // Pagination with guards to prevent invalid states
  const safePerPage = Math.max(1, Math.floor(entriesPerPage));
  const totalPages = Math.max(1, Math.ceil(processedMarkets.length / safePerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * safePerPage;
  const paginatedMarkets = processedMarkets.slice(startIndex, startIndex + safePerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [collateralFilter, oracleFilter]);

  // Clamp currentPage when totalPages changes
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const hasActiveFilters = collateralFilter.length > 0 || oracleFilter.length > 0 || searchQuery.length > 0;

  const clearAllFilters = () => {
    setCollateralFilter([]);
    setOracleFilter([]);
    setSearchQuery('');
  };

  return (
    <div className=" space-y-3">
      {/* Search + Filters + Controls - All on one line */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap lg:min-w-[800px]">
        <ExpandableSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search markets..."
        />
        <AssetFilter
          showLabelPrefix
          label="Collateral"
          placeholder="All"
          selectedAssets={collateralFilter}
          setSelectedAssets={setCollateralFilter}
          items={availableCollaterals}
          loading={false}
        />
        <OracleFilter
          showLabelPrefix
          selectedOracles={oracleFilter}
          setSelectedOracles={setOracleFilter}
          availableOracles={availableOracles}
        />
        {hasActiveFilters && <ClearFiltersButton onClick={clearAllFilters} />}
        <div className="flex items-center gap-2 sm:ml-auto">
          <MarketFilter variant="button" />
          <Button
            variant="default"
            size="md"
            onClick={() => openModal('marketSettings', {})}
            className="w-10 min-w-10 px-0"
            aria-label="Market settings"
          >
            <GearIcon />
          </Button>
        </div>
      </div>

      {/* Table or Empty State */}
      {paginatedMarkets.length === 0 ? (
        <EmptyScreen
          message="No markets found"
          hint="Try adjusting your filter settings or search query"
          className="min-h-64"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="responsive rounded-md font-zen text-sm">
            <thead className="">
              <tr>
                {showSelectColumn && (
                  <th
                    className="text-center font-normal px-2 py-2"
                    style={{
                      padding: '0.5rem',
                      paddingTop: '1rem',
                      paddingBottom: '1rem',
                    }}
                  >
                    Select
                  </th>
                )}
                <th
                  className="text-center font-normal px-2 py-2"
                  style={{
                    padding: '0.5rem',
                    paddingTop: '1rem',
                    paddingBottom: '1rem',
                  }}
                >
                  Id
                </th>
                <HTSortable
                  label="Market"
                  column={SortColumn.COLLATSYMBOL}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                {columnVisibility.trustedBy && (
                  <HTSortable
                    label="Trusted By"
                    column={SortColumn.TrustedBy}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                {columnVisibility.totalSupply && (
                  <HTSortable
                    label="Total Supply"
                    column={SortColumn.Supply}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                {columnVisibility.totalBorrow && (
                  <HTSortable
                    label="Total Borrow"
                    column={SortColumn.Borrow}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                {columnVisibility.liquidity && (
                  <HTSortable
                    label="Liquidity"
                    column={SortColumn.Liquidity}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                {columnVisibility.supplyAPY && (
                  <HTSortable
                    label={supplyRateLabel}
                    column={SortColumn.APY}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                {columnVisibility.borrowAPY && (
                  <HTSortable
                    label={borrowRateLabel}
                    column={SortColumn.BorrowAPY}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                {columnVisibility.rateAtTarget && (
                  <HTSortable
                    label="Rate at Target"
                    column={SortColumn.RateAtTarget}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                {columnVisibility.utilizationRate && (
                  <HTSortable
                    label="Utilization"
                    column={SortColumn.UtilizationRate}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
                <th
                  className="text-center font-normal px-2 py-2"
                  style={{ padding: '0.5rem' }}
                >
                  Indicators
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedMarkets.map((marketWithSelection) => (
                <MarketRow
                  key={marketWithSelection.market.uniqueKey}
                  marketWithSelection={marketWithSelection}
                  onToggle={() => onToggleMarket(marketWithSelection.market.uniqueKey)}
                  disabled={disabled}
                  showSelectColumn={showSelectColumn}
                  trustedVaultMap={trustedVaultMap}
                  supplyRateLabel={supplyRateLabel}
                  borrowRateLabel={borrowRateLabel}
                  isAprDisplay={isAprDisplay}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <TablePagination
        totalPages={totalPages}
        totalEntries={processedMarkets.length}
        currentPage={safePage}
        pageSize={safePerPage}
        onPageChange={setCurrentPage}
        isLoading={false}
      />
    </div>
  );
}

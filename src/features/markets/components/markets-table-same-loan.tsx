import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, TrashIcon, GearIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaSearch } from 'react-icons/fa';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { Button } from '@/components/ui/button';
import { SuppliedAssetFilterCompactSwitch } from '@/features/positions/components/supplied-asset-filter-compact-switch';
import { TablePagination } from '@/components/shared/table-pagination';
import { useTokens } from '@/components/providers/TokenProvider';
import TrustedVaultsModal from '@/modals/settings/trusted-vaults-modal';
import { TrustedByCell } from '@/features/autovault/components/trusted-vault-badges';
import { DEFAULT_MIN_SUPPLY_USD, DEFAULT_MIN_LIQUIDITY_USD } from '@/constants/markets';
import { defaultTrustedVaults, getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useFreshMarketsState } from '@/hooks/useFreshMarketsState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarkets } from '@/hooks/useMarkets';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatBalance, formatReadable } from '@/utils/balance';
import { filterMarkets, sortMarkets, createPropertySort } from '@/utils/marketFilters';
import { parseNumericThreshold } from '@/utils/markets';
import { getViemChain } from '@/utils/networks';
import { parsePriceFeedVendors, PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import { convertApyToApr } from '@/utils/rateMath';
import { storageKeys } from '@/utils/storageKeys';
import { type ERC20Token, type UnknownERC20Token, infoToKey } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { buildTrustedVaultMap } from '@/utils/vaults';
import { DEFAULT_COLUMN_VISIBILITY, type ColumnVisibility } from '@/features/markets/components/column-visibility';
import MarketSettingsModal from '@/features/markets/components/market-settings-modal';
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
  // Optional: Render additional content for selected markets in the cart
  renderCartItemExtra?: (market: Market) => React.ReactNode;
  // Optional: Pass unique tokens for better filter performance
  uniqueCollateralTokens?: ERC20Token[];
  // Optional: Hide the select column (useful for single-select mode)
  showSelectColumn?: boolean;
  // Optional: Show the settings button (default: true)
  showSettings?: boolean;
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

// Compact Collateral Filter
function CollateralFilter({
  selectedCollaterals,
  setSelectedCollaterals,
  availableCollaterals,
}: {
  selectedCollaterals: string[];
  setSelectedCollaterals: (collaterals: string[]) => void;
  availableCollaterals: (ERC20Token | UnknownERC20Token)[];
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const selectOption = (token: ERC20Token | UnknownERC20Token) => {
    const tokenKey = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
    if (selectedCollaterals.includes(tokenKey)) {
      setSelectedCollaterals(selectedCollaterals.filter((c) => c !== tokenKey));
    } else {
      setSelectedCollaterals([...selectedCollaterals, tokenKey]);
    }
  };

  const clearSelection = () => {
    setSelectedCollaterals([]);
    setQuery('');
    setIsOpen(false);
  };

  const filteredItems = availableCollaterals.filter((token) => token.symbol.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      className="relative z-30 w-full max-w-xs"
      ref={dropdownRef}
    >
      <div
        className={`bg-surface min-w-32 cursor-pointer rounded-sm p-2 text-sm shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-surface-dark' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleDropdown();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          {selectedCollaterals.length > 0 ? (
            <div className="flex-scroll flex gap-1.5">
              {selectedCollaterals.map((key) => {
                const token = availableCollaterals.find(
                  (item) => item.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|') === key,
                );
                return token ? (
                  token.img ? (
                    <Image
                      key={key}
                      src={token.img}
                      alt={token.symbol}
                      width={14}
                      height={14}
                    />
                  ) : (
                    <div
                      key={key}
                      className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-gray-200 text-[10px] dark:bg-gray-700"
                    >
                      ?
                    </div>
                  )
                ) : null;
              })}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Filter collaterals</span>
          )}
          <span className={`ml-auto transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="bg-surface absolute z-50 mt-1 w-full rounded-sm shadow-lg"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full border-none bg-transparent p-2 text-xs focus:outline-none"
            />
            <div className="relative">
              <ul
                className="custom-scrollbar max-h-60 overflow-auto pb-10"
                role="listbox"
              >
                {filteredItems.map((token) => {
                  const tokenKey = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
                  return (
                    <li
                      key={tokenKey}
                      className={`m-2 flex cursor-pointer items-center justify-between rounded-md p-2 text-xs hover:bg-gray-300 dark:hover:bg-gray-700 ${
                        selectedCollaterals.includes(tokenKey) ? 'bg-gray-300 dark:bg-gray-700' : ''
                      }`}
                      onClick={() => selectOption(token)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          selectOption(token);
                        }
                      }}
                      role="option"
                      aria-selected={selectedCollaterals.includes(tokenKey)}
                      tabIndex={0}
                    >
                      <span title={token.symbol}>{token.symbol.length > 8 ? `${token.symbol.slice(0, 8)}...` : token.symbol}</span>
                      {token.img ? (
                        <Image
                          src={token.img}
                          alt={token.symbol}
                          width={14}
                          height={14}
                        />
                      ) : (
                        <div className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-gray-200 text-[10px] dark:bg-gray-700">
                          ?
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="bg-surface absolute bottom-0 left-0 right-0 border-gray-700 p-1.5">
                <button
                  className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-left text-[10px] "
                  style={{ color: 'var(--color-text-secondary)' }}
                  onClick={clearSelection}
                  type="button"
                >
                  <span>Clear All</span>
                  <TrashIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact Oracle Filter
function OracleFilterComponent({
  selectedOracles,
  setSelectedOracles,
  availableOracles,
}: {
  selectedOracles: PriceFeedVendors[];
  setSelectedOracles: (oracles: PriceFeedVendors[]) => void;
  availableOracles: PriceFeedVendors[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const toggleOracle = (oracle: PriceFeedVendors) => {
    if (selectedOracles.includes(oracle)) {
      setSelectedOracles(selectedOracles.filter((o) => o !== oracle));
    } else {
      setSelectedOracles([...selectedOracles, oracle]);
    }
  };

  return (
    <div
      className="relative z-30 w-full max-w-xs"
      ref={dropdownRef}
    >
      <div
        className={`bg-surface min-w-32 cursor-pointer rounded-sm p-2 text-sm shadow-sm transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-gray-200 dark:bg-gray-700' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleDropdown();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          {selectedOracles.length > 0 ? (
            <div className="flex-scroll flex gap-1.5">
              {selectedOracles.map((oracle, index) => (
                <div key={index}>
                  {OracleVendorIcons[oracle] ? (
                    <Image
                      src={OracleVendorIcons[oracle]}
                      alt={oracle}
                      height={14}
                      width={14}
                    />
                  ) : (
                    <IoHelpCircleOutline
                      style={{ color: 'var(--color-text-secondary)' }}
                      size={14}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Filter oracles</span>
          )}
          <span className={`ml-auto transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
      <div
        className={`bg-surface absolute z-50 mt-1 w-full transform rounded-sm shadow-lg transition-all duration-200 ${
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <ul
          className="custom-scrollbar max-h-60 overflow-auto"
          role="listbox"
        >
          {availableOracles.map((oracle) => (
            <li
              key={oracle}
              className={`m-2 flex cursor-pointer items-center justify-between rounded p-1.5 text-xs transition-colors duration-200 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                selectedOracles.includes(oracle) ? 'bg-gray-300 dark:bg-gray-700' : ''
              }`}
              onClick={() => toggleOracle(oracle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleOracle(oracle);
                }
              }}
              role="option"
              aria-selected={selectedOracles.includes(oracle)}
              tabIndex={0}
            >
              <div className="flex items-center gap-2">
                {OracleVendorIcons[oracle] ? (
                  <Image
                    src={OracleVendorIcons[oracle]}
                    alt={oracle}
                    width={14}
                    height={14}
                    className="rounded-full"
                  />
                ) : (
                  <IoHelpCircleOutline
                    style={{ color: 'var(--color-text-secondary)' }}
                    size={14}
                  />
                )}
                <span>{oracle === PriceFeedVendors.Unknown ? 'Unknown Feed' : oracle}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MarketRow({
  marketWithSelection,
  onToggle,
  disabled,
  showSelectColumn,
  columnVisibility,
  trustedVaultMap,
  supplyRateLabel,
  borrowRateLabel,
  isAprDisplay,
}: {
  marketWithSelection: MarketWithSelection;
  onToggle: () => void;
  disabled: boolean;
  showSelectColumn: boolean;
  columnVisibility: ColumnVisibility;
  trustedVaultMap: Map<string, TrustedVault>;
  supplyRateLabel: string;
  borrowRateLabel: string;
  isAprDisplay: boolean;
}) {
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
  renderCartItemExtra,
  uniqueCollateralTokens,
  showSelectColumn = true,
  showSettings = true,
}: MarketsTableWithSameLoanAssetProps): JSX.Element {
  // Get global market settings
  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets, isAprDisplay } = useMarkets();
  const { findToken } = useTokens();
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

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTrustedVaultsModal, setShowTrustedVaultsModal] = useState(false);

  // Table state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>(SortColumn.Supply);
  const [sortDirection, setSortDirection] = useState<1 | -1>(-1); // -1 = desc, 1 = asc
  const [collateralFilter, setCollateralFilter] = useState<string[]>([]);
  const [oracleFilter, setOracleFilter] = useState<PriceFeedVendors[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings state (persisted with storage key namespace)
  const [entriesPerPage, setEntriesPerPage] = useLocalStorage(storageKeys.MarketEntriesPerPageKey, 8);
  const [includeUnknownTokens, setIncludeUnknownTokens] = useLocalStorage(storageKeys.MarketsShowUnknownTokens, false);
  const [showUnknownOracle, setShowUnknownOracle] = useLocalStorage(storageKeys.MarketsShowUnknownOracle, false);
  const [userTrustedVaults, setUserTrustedVaults] = useLocalStorage<TrustedVault[]>('userTrustedVaults', defaultTrustedVaults);

  // Store USD filters as separate localStorage items to match markets.tsx pattern
  const [usdMinSupply, setUsdMinSupply] = useLocalStorage(storageKeys.MarketsUsdMinSupplyKey, DEFAULT_MIN_SUPPLY_USD.toString());
  const [usdMinBorrow, setUsdMinBorrow] = useLocalStorage(storageKeys.MarketsUsdMinBorrowKey, '');
  const [usdMinLiquidity, setUsdMinLiquidity] = useLocalStorage(
    storageKeys.MarketsUsdMinLiquidityKey,
    DEFAULT_MIN_LIQUIDITY_USD.toString(),
  );

  const [trustedVaultsOnly, setTrustedVaultsOnly] = useLocalStorage(storageKeys.MarketsTrustedVaultsOnlyKey, false);

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

  // USD Filter enabled states
  const [minSupplyEnabled, setMinSupplyEnabled] = useLocalStorage(
    storageKeys.MarketsMinSupplyEnabledKey,
    true, // Default to enabled for backward compatibility
  );
  const [minBorrowEnabled, setMinBorrowEnabled] = useLocalStorage(storageKeys.MarketsMinBorrowEnabledKey, false);
  const [minLiquidityEnabled, setMinLiquidityEnabled] = useLocalStorage(storageKeys.MarketsMinLiquidityEnabledKey, false);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useLocalStorage<ColumnVisibility>(
    storageKeys.MarketsColumnVisibilityKey,
    DEFAULT_COLUMN_VISIBILITY,
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

  const setUsdFilters = useCallback(
    (filters: { minSupply: string; minBorrow: string; minLiquidity: string }) => {
      setUsdMinSupply(filters.minSupply);
      setUsdMinBorrow(filters.minBorrow);
      setUsdMinLiquidity(filters.minLiquidity);
    },
    [setUsdMinSupply, setUsdMinBorrow, setUsdMinLiquidity],
  );

  const effectiveMinSupply = parseNumericThreshold(usdFilters.minSupply);
  const effectiveMinBorrow = parseNumericThreshold(usdFilters.minBorrow);
  const effectiveMinLiquidity = parseNumericThreshold(usdFilters.minLiquidity);

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

  // Get selected markets
  const _selectedMarkets = useMemo(() => {
    return markets.filter((m) => m.isSelected);
  }, [markets]);

  // Pagination with guards to prevent invalid states
  const safePerPage = Math.max(1, Math.floor(entriesPerPage));
  const totalPages = Math.max(1, Math.ceil(processedMarkets.length / safePerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * safePerPage;
  const paginatedMarkets = processedMarkets.slice(startIndex, startIndex + safePerPage);
  const emptyStateColumns =
    (showSelectColumn ? 7 : 6) +
    (columnVisibility.trustedBy ? 1 : 0) +
    (columnVisibility.totalSupply ? 1 : 0) +
    (columnVisibility.totalBorrow ? 1 : 0) +
    (columnVisibility.liquidity ? 1 : 0) +
    (columnVisibility.supplyAPY ? 1 : 0) +
    (columnVisibility.borrowAPY ? 1 : 0) +
    (columnVisibility.rateAtTarget ? 1 : 0) +
    (columnVisibility.utilizationRate ? 1 : 0);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [collateralFilter, oracleFilter]);

  // Clamp currentPage when totalPages changes
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  return (
    <div className="space-y-3">
      {/* Search and Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-80">
          <Input
            placeholder="Search by collateral symbol or market ID..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            endContent={<FaSearch style={{ color: 'var(--color-text-secondary)' }} />}
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
              variant="ghost"
              size="sm"
              onClick={() => setShowSettingsModal(true)}
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
        <OracleFilterComponent
          selectedOracles={oracleFilter}
          setSelectedOracles={setOracleFilter}
          availableOracles={availableOracles}
        />
      </div>

      {/* Table */}
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
            {paginatedMarkets.length === 0 ? (
              <tr>
                <td
                  colSpan={emptyStateColumns}
                  className="py-8 text-center "
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  No markets found
                </td>
              </tr>
            ) : (
              paginatedMarkets.map((marketWithSelection) => (
                <MarketRow
                  key={marketWithSelection.market.uniqueKey}
                  marketWithSelection={marketWithSelection}
                  onToggle={() => onToggleMarket(marketWithSelection.market.uniqueKey)}
                  disabled={disabled}
                  showSelectColumn={showSelectColumn}
                  columnVisibility={columnVisibility}
                  trustedVaultMap={trustedVaultMap}
                  supplyRateLabel={supplyRateLabel}
                  borrowRateLabel={borrowRateLabel}
                  isAprDisplay={isAprDisplay}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <TablePagination
        totalPages={totalPages}
        totalEntries={processedMarkets.length}
        currentPage={safePage}
        pageSize={safePerPage}
        onPageChange={setCurrentPage}
        isLoading={false}
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
          setUserTrustedVaults={setUserTrustedVaults}
        />
      )}
    </div>
  );
}

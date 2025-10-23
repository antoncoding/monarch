import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { LuX } from 'react-icons/lu';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getViemChain } from '@/utils/networks';
import { parsePriceFeedVendors, PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import { ERC20Token, UnknownERC20Token, infoToKey, findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { Pagination } from '../../../app/markets/components/Pagination';
import { MarketIdBadge } from '../MarketIdBadge';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '../MarketIdentity';
import { MarketIndicators } from '../MarketIndicators';
import { Checkbox } from '@heroui/react';

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
  // Optional: Hide the cart/staging area showing selected markets
  showCart?: boolean;
  // Optional: entry per page
  itemsPerPage?: number
};

enum SortColumn {
  MarketName = 0,
  Supply = 1,
  APY = 2,
  Liquidity = 3,
  Risk = 4,
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
      className={`cursor-pointer select-none text-center font-normal ${isSorting ? 'text-primary' : ''}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center justify-center gap-1">
        <div>{label}</div>
        {isSorting &&
          (sortDirection === 1 ? <ArrowDownIcon /> : <ArrowUpIcon />)}
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

  const filteredItems = availableCollaterals.filter((token) =>
    token.symbol.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative z-30 w-full" ref={dropdownRef}>
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
                    <Image key={key} src={token.img} alt={token.symbol} width={14} height={14} />
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
              <ul className="custom-scrollbar max-h-60 overflow-auto pb-10" role="listbox">
                {filteredItems.map((token) => {
                  const tokenKey = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
                  return (
                    <li
                      key={tokenKey}
                      className={`m-2 flex cursor-pointer items-center justify-between rounded-md p-2 text-xs hover:bg-gray-300 dark:hover:bg-gray-700 ${
                        selectedCollaterals.includes(tokenKey)
                          ? 'bg-gray-300 dark:bg-gray-700'
                          : ''
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
                      <span title={token.symbol}>
                        {token.symbol.length > 8 ? `${token.symbol.slice(0, 8)}...` : token.symbol}
                      </span>
                      {token.img ? (
                        <Image src={token.img} alt={token.symbol} width={14} height={14} />
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
                  className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-left text-[10px] text-secondary"
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
    <div className="relative z-30 w-full" ref={dropdownRef}>
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
                    <Image src={OracleVendorIcons[oracle]} alt={oracle} height={14} width={14} />
                  ) : (
                    <IoHelpCircleOutline className="text-secondary" size={14} />
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
        <ul className="custom-scrollbar max-h-60 overflow-auto" role="listbox">
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
                  <IoHelpCircleOutline className="text-secondary" size={14} />
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
}: {
  marketWithSelection: MarketWithSelection;
  onToggle: () => void;
  disabled: boolean;
  showSelectColumn: boolean;
}) {
  const { market, isSelected } = marketWithSelection;

  return (
    <tr
      className={`cursor-pointer transition-colors hover:bg-surface-dark ${
        isSelected ? 'bg-primary/5' : ''
      }`}
      onClick={(e) => {
        // Don't toggle if clicking on input
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          onToggle();
        }
      }}
    >
      {showSelectColumn && (
        <td className="z-50 py-1">
          <div className="flex items-center justify-center gap-2">
            <Checkbox
              isSelected={isSelected}
              onChange={onToggle}
              isDisabled={disabled}
              className="h-6 w-4 cursor-pointer rounded border-gray-300 text-primary"
              onSelect={(e) => e.stopPropagation()}
              size='sm'
            />
          </div>
        </td>
      )}
      <td className="z-50 py-1 text-center">
        <MarketIdBadge marketId={market.uniqueKey} chainId={market.morphoBlue.chain.id} />
      </td>
      <td className="z-50 py-1 pl-4" style={{ width: '240px' }}>
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
      <td data-label="Total Supply" className="z-50 py-1 text-center">
        <p className="text-xs">
          {formatReadable(formatBalance(market.state.supplyAssets, market.loanAsset.decimals))}
        </p>
      </td>
      <td data-label="APY" className="z-50 py-1 text-center text-sm flex items-center">
        <p>
          {market.state.supplyApy ? `${(market.state.supplyApy * 100).toFixed(2)}` : '—'}
        </p>
        { market.state.supplyApy && <span className='text-xs'> % </span>}
      </td>
      <td data-label="Liquidity" className="z-50 py-1 text-center">
        <p className="text-xs">
          {formatReadable(formatBalance(market.state.liquidityAssets, market.loanAsset.decimals))}
        </p>
      </td>
      <td data-label="Indicators" className="z-50 py-1 text-center">
        <MarketIndicators market={market} showRisk />
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
  showCart = true,
  itemsPerPage = 8
}: MarketsTableWithSameLoanAssetProps): JSX.Element {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>(SortColumn.Supply);
  const [sortDirection, setSortDirection] = useState<1 | -1>(-1); // -1 = desc, 1 = asc
  const [collateralFilter, setCollateralFilter] = useState<string[]>([]);
  const [oracleFilter, setOracleFilter] = useState<PriceFeedVendors[]>([]);

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
      return uniqueCollateralTokens;
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
            networks: [{
              address: m.market.collateralAsset.address,
              chain: getViemChain(m.market.morphoBlue.chain.id),
            }],
          };
          tokenMap.set(key, token);
        }
      }
    });

    return Array.from(tokenMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [markets, uniqueCollateralTokens]);

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

  // Filter and sort markets
  const processedMarkets = useMemo(() => {
    let filtered = [...markets];

    // Apply collateral filter
    if (collateralFilter.length > 0) {
      filtered = filtered.filter((m) => {
        // Add null checks
        if (!m?.market?.collateralAsset?.address || !m?.market?.morphoBlue?.chain?.id) {
          return false;
        }
        const key = infoToKey(m.market.collateralAsset.address, m.market.morphoBlue.chain.id);
        return collateralFilter.some((filterKey) =>
          filterKey.split('|').includes(key)
        );
      });
    }

    // Apply oracle filter
    if (oracleFilter.length > 0) {
      filtered = filtered.filter((m) => {
        // Add null checks
        if (!m?.market?.morphoBlue?.chain?.id) {
          return false;
        }
        const vendorInfo = parsePriceFeedVendors(m.market.oracle?.data, m.market.morphoBlue.chain.id);
        return vendorInfo?.coreVendors?.some((v) => oracleFilter.includes(v)) ?? false;
      });
    }

    // Sort
      filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case SortColumn.MarketName:
          comparison = (a.market?.collateralAsset?.symbol ?? '').localeCompare(
            b.market?.collateralAsset?.symbol ?? '',
          );
          break;
        case SortColumn.Supply:
          comparison =
            Number(a.market?.state?.supplyAssetsUsd ?? 0) - Number(b.market?.state?.supplyAssetsUsd ?? 0);
          break;
        case SortColumn.APY:
          comparison = (a.market?.state?.supplyApy ?? 0) - (b.market?.state?.supplyApy ?? 0);
          break;
        case SortColumn.Liquidity:
          comparison =
            Number(a.market?.state?.liquidityAssets ?? 0) - Number(b.market?.state?.liquidityAssets ?? 0);
          break;
        case SortColumn.Risk:
          comparison = 0;
          break;
      }
      return comparison * sortDirection;
    });

    return filtered;
  }, [markets, collateralFilter, oracleFilter, sortColumn, sortDirection]);

  // Get selected markets
  const selectedMarkets = useMemo(() => {
    return markets.filter((m) => m.isSelected);
  }, [markets]);

  // Pagination
  const totalPages = Math.ceil(processedMarkets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMarkets = processedMarkets.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [collateralFilter, oracleFilter]);

  return (
    <div className="space-y-3">
      {/* Cart/Staging Area - MarketDetailsBlock Style */}
      {showCart && selectedMarkets.length > 0 && (
        <div className="space-y-2">
          {selectedMarkets.map(({ market }) => (
            <div
              key={market.uniqueKey}
              className="bg-hovered rounded transition-colors"
            >
              <div className="flex items-center justify-between p-2">
                <MarketIdentity
                  market={market}
                  chainId={market.morphoBlue.chain.id}
                  mode={MarketIdentityMode.Focused}
                  focus={MarketIdentityFocus.Collateral}
                  showLltv
                  showOracle
                  iconSize={20}
                  showExplorerLink={false}
                />

                <div className="flex items-center gap-2">
                  {renderCartItemExtra && renderCartItemExtra(market)}
                  <button
                    type="button"
                    onClick={() => onToggleMarket(market.uniqueKey)}
                    disabled={disabled}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                  >
                    <LuX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
      <div className="w-full overflow-x-auto">
        <table className="responsive w-full rounded-md font-zen text-sm">
          <thead className="table-header">
            <tr>
              {showSelectColumn && <th className="text-center font-normal">Select</th>}
              <th className="text-center font-normal">Id</th>
              <HTSortable
                label="Market"
                column={SortColumn.MarketName}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <HTSortable
                label="Total Supply"
                column={SortColumn.Supply}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <HTSortable
                label="APY"
                column={SortColumn.APY}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <HTSortable
                label="Liquidity"
                column={SortColumn.Liquidity}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <th className="text-center font-normal">Indicators</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMarkets.length === 0 ? (
              <tr>
                <td colSpan={showSelectColumn ? 7 : 6} className="py-8 text-center text-secondary">
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        entriesPerPage={itemsPerPage}
        isDataLoaded
        size="sm"
      />
    </div>
  );
}

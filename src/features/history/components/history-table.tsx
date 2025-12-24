'use client';

import React from 'react';
import { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { ChevronDownIcon, TrashIcon, ReloadIcon, GearIcon } from '@radix-ui/react-icons';
import { MdWarning } from 'react-icons/md';
import Image from 'next/image';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Input } from '@/components/ui/input';
import { Divider } from '@/components/ui/divider';
import { FilterRow, FilterSection } from '@/components/ui/filter-components';
import { TablePagination } from '@/components/shared/table-pagination';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { MarketIdentity, MarketIdentityFocus } from '@/features/markets/components/market-identity';
import { RebalanceDetail } from './rebalance-detail';
import { getTruncatedAssetName } from '@/utils/oracle';
import { useMarkets } from '@/contexts/MarketsContext';
import useUserTransactions from '@/hooks/useUserTransactions';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useStyledToast } from '@/hooks/useStyledToast';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { groupTransactionsByHash, type GroupedTransaction } from '@/utils/transactionGrouping';
import { storageKeys } from '@/utils/storageKeys';
import { UserTxTypes, type Market, type MarketPosition, type UserTransaction } from '@/utils/types';

type HistoryTableProps = {
  account: string | undefined;
  positions: MarketPosition[];
  isVaultAdapter?: boolean;
};

type AssetKey = {
  symbol: string;
  chainId: number;
  address: string;
  decimals: number;
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const txTime = timestamp * 1000;
  const diffInSeconds = Math.floor((now - txTime) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
};

export function HistoryTable({ account, positions, isVaultAdapter = false }: HistoryTableProps) {
  const searchParams = useSearchParams();
  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { allMarkets } = useMarkets();
  const toast = useStyledToast();

  const { loading, fetchTransactions } = useUserTransactions();
  const [currentPage, setCurrentPage] = useState(1);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  // Settings state
  const [pageSize, setPageSize] = useLocalStorage<number>(storageKeys.HistoryEntriesPerPageKey, 10);
  const [isGroupedView, setIsGroupedView] = useLocalStorage<boolean>(storageKeys.HistoryGroupedViewKey, true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsOpenChange } = useDisclosure();

  // Temporary input state for settings modal
  const [customPageSize, setCustomPageSize] = useState(pageSize.toString());

  // Group transactions for display (especially useful for vault adapter mode)
  const groupedHistory = useMemo(() => groupTransactionsByHash(history), [history]);

  // For ungrouped view, convert individual transactions to GroupedTransaction format
  const ungroupedHistory = useMemo(
    () =>
      history.map(
        (tx): GroupedTransaction => ({
          hash: tx.hash,
          timestamp: tx.timestamp,
          isMetaAction: false,
          transactions: [tx],
        }),
      ),
    [history],
  );

  // Helper functions
  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  };

  const handleManualRefresh = () => {
    void (async () => {
      if (!account || !fetchTransactions || allMarkets.length === 0) return;

      const result = await fetchTransactions({
        userAddress: [account],
        first: pageSize,
        skip: (currentPage - 1) * pageSize,
        marketUniqueKeys: marketIdFilter,
      });

      if (result) {
        setHistory(result.items);
        setTotalPages(Math.ceil(result.pageInfo.countTotal / pageSize));
        toast.info('Data updated', 'Transaction history updated', {
          icon: <span>🔄</span>,
        });
      }
    })();
  };

  const handlePageSizeUpdate = () => {
    const value = Number(customPageSize);
    if (!Number.isNaN(value) && value > 0) {
      setPageSize(value);
      setCurrentPage(1);
    }
    setCustomPageSize(value > 0 ? String(value) : pageSize.toString());
  };

  // Get unique assets with their chain IDs
  const uniqueAssets = useMemo(() => {
    const assetMap = new Map<string, AssetKey>();
    positions.forEach((pos) => {
      const market = allMarkets.find((m) => m.uniqueKey === pos.market.uniqueKey);
      if (!market) return;

      const key = `${market.loanAsset.address}-${market.morphoBlue.chain.id}`;
      if (!assetMap.has(key)) {
        assetMap.set(key, {
          symbol: market.loanAsset.symbol,
          chainId: market.morphoBlue.chain.id,
          address: market.loanAsset.address,
          decimals: market.loanAsset.decimals,
        });
      }
    });
    return Array.from(assetMap.values());
  }, [positions, allMarkets]);

  // Handle initial URL parameters for pre-filtering (only once)
  useEffect(() => {
    // Only initialize once and only if we have URL params
    if (hasInitializedFromUrl) return;

    const chainIdParam = searchParams.get('chainId');
    const tokenAddressParam = searchParams.get('tokenAddress');

    // If no URL params, we're done initializing
    if (!chainIdParam || !tokenAddressParam) {
      setHasInitializedFromUrl(true);
      return;
    }

    // Wait for markets to load before initializing
    if (allMarkets.length === 0) return;

    const chainId = Number.parseInt(chainIdParam, 10);

    // Try to find in uniqueAssets first (from user positions)
    const matchingAsset = uniqueAssets.find(
      (asset) => asset.chainId === chainId && asset.address.toLowerCase() === tokenAddressParam.toLowerCase(),
    );

    if (matchingAsset) {
      setSelectedAsset(matchingAsset);
      setHasInitializedFromUrl(true);
    }
  }, [searchParams, uniqueAssets, allMarkets, hasInitializedFromUrl]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAsset]);

  // Reset page when view mode or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [isGroupedView, pageSize]);

  // Get filtered market IDs based on selected asset
  const marketIdFilter = useMemo(() => {
    if (!selectedAsset) return [];

    return allMarkets
      .filter((m) => m.loanAsset.symbol === selectedAsset.symbol && m.morphoBlue.chain.id === selectedAsset.chainId)
      .map((m) => m.uniqueKey);
  }, [selectedAsset, allMarkets]);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!account || !fetchTransactions || allMarkets.length === 0) return;

      const result = await fetchTransactions({
        userAddress: [account],
        first: pageSize,
        skip: (currentPage - 1) * pageSize,
        marketUniqueKeys: marketIdFilter,
      });

      if (result) {
        setHistory(result.items);
        setTotalPages(Math.ceil(result.pageInfo.countTotal / pageSize));
      }
      setIsInitialized(true);
    };

    void loadTransactions();
  }, [account, currentPage, fetchTransactions, marketIdFilter]);

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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const filteredAssets = uniqueAssets.filter((asset) => asset.symbol.toLowerCase().includes(query.toLowerCase()));

  const toggleDropdown = () => setIsOpen(!isOpen);

  // Skeleton loading rows
  const renderSkeletonRows = (count = 5) => {
    return Array.from({ length: count }).map((_, idx) => (
      <TableRow key={`skeleton-${idx}`}>
        {!isVaultAdapter && (
          <TableCell style={{ minWidth: '100px' }}>
            <div className="flex items-center justify-center gap-1.5">
              <div className="bg-hovered h-4 w-4 rounded-full animate-pulse" />
              <div className="bg-hovered h-4 w-16 rounded animate-pulse" />
            </div>
          </TableCell>
        )}
        <TableCell style={{ minWidth: '140px' }}>
          <div className="flex items-center justify-center gap-2">
            <div className="bg-hovered h-4 w-24 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell style={{ minWidth: '80px' }}>
          <div className="flex justify-center">
            <div className="bg-hovered h-6 w-16 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell
          className="text-right"
          style={{ minWidth: '120px' }}
        >
          <div className="flex justify-end">
            <div className="bg-hovered h-4 w-24 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell style={{ minWidth: '120px' }}>
          <div className="flex justify-center">
            <div className="bg-hovered h-4 w-20 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell
          className="text-right"
          style={{ minWidth: '90px' }}
        >
          <div className="flex justify-end">
            <div className="bg-hovered h-4 w-12 rounded animate-pulse" />
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  // Helper to render a single transaction row
  const renderSingleTransactionRow = (tx: UserTransaction, index: number) => {
    if (!tx.data.market) return null;

    const market = allMarkets.find((m) => m.uniqueKey === tx.data.market.uniqueKey) as Market | undefined;
    if (!market) return null;

    const sign = tx.type === UserTxTypes.MarketSupply ? '+' : '-';
    const side = tx.type === UserTxTypes.MarketSupply ? 'Supply' : 'Withdraw';

    return (
      <TableRow
        key={`${tx.hash}-${index}`}
        className="hover:bg-hovered"
      >
        {/* Loan Asset - only show if not vault adapter */}
        {!isVaultAdapter && (
          <TableCell
            data-label="Loan Asset"
            className="z-50"
            style={{ minWidth: '100px' }}
          >
            <div className="flex items-center justify-center gap-1.5">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={16}
                height={16}
              />
              <span className="text-sm whitespace-nowrap">{getTruncatedAssetName(market.loanAsset.symbol)}</span>
            </div>
          </TableCell>
        )}

        {/* Market */}
        <TableCell
          data-label="Market"
          className="z-50"
          style={{ minWidth: '140px' }}
        >
          <Link
            href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
            className="no-underline hover:no-underline"
          >
            <div className="flex items-center justify-center gap-2">
              <MarketIdentity
                market={market}
                chainId={market.morphoBlue.chain.id}
                showOracle={false}
                showLltv
                focus={isVaultAdapter ? MarketIdentityFocus.Collateral : MarketIdentityFocus.Collateral}
              />
            </div>
          </Link>
        </TableCell>

        {/* Side */}
        <TableCell
          data-label="Side"
          className="z-50 text-center"
          style={{ minWidth: '80px' }}
        >
          <span
            className={`inline-flex items-center rounded bg-hovered px-2 py-1 text-xs ${
              side === 'Supply' ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {side}
          </span>
        </TableCell>

        {/* Amount */}
        <TableCell
          data-label="Amount"
          className="z-50 text-right"
          style={{ minWidth: '120px' }}
        >
          <span className="text-sm">
            {sign}
            {formatReadable(Number(formatUnits(BigInt(tx.data.assets), market.loanAsset.decimals)))}{' '}
            {getTruncatedAssetName(market.loanAsset.symbol)}
          </span>
        </TableCell>

        {/* Transaction Hash */}
        <TableCell
          data-label="Tx Hash"
          className="z-50"
          style={{ minWidth: '120px' }}
        >
          <div className="flex justify-center">
            <TransactionIdentity
              txHash={tx.hash}
              chainId={market.morphoBlue.chain.id}
            />
          </div>
        </TableCell>

        {/* Time */}
        <TableCell
          data-label="Time"
          className="z-50 text-right"
          style={{ minWidth: '90px' }}
        >
          <span className="text-xs text-secondary whitespace-nowrap">{formatTimeAgo(tx.timestamp)}</span>
        </TableCell>
      </TableRow>
    );
  };

  // Header actions for table
  const headerActions = (
    <>
      <Tooltip
        content={
          <TooltipContent
            title="Refresh"
            detail="Fetch latest transaction data"
          />
        }
      >
        <span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={loading}
            className="text-secondary min-w-0 px-2"
          >
            <ReloadIcon className={`${loading ? 'animate-spin' : ''} h-3 w-3`} />
          </Button>
        </span>
      </Tooltip>
      <Tooltip
        content={
          <TooltipContent
            title="Settings"
            detail="Configure view settings"
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="text-secondary min-w-0 px-2"
          onClick={onSettingsOpen}
        >
          <GearIcon className="h-3 w-3" />
        </Button>
      </Tooltip>
    </>
  );

  return (
    <div className="space-y-4">
      {isVaultAdapter && (
        <div className="rounded bg-hovered/30 border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-secondary">Viewing vault adapter transaction history</p>
        </div>
      )}
      {!isVaultAdapter && (
        <div
          className="relative w-fit max-w-md z-50"
          ref={dropdownRef}
        >
          <div
            className={`bg-surface min-w-64 cursor-pointer rounded-sm p-2 shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
              isOpen ? 'bg-surface-dark' : ''
            }`}
            role="button"
            tabIndex={0}
            onClick={toggleDropdown}
            onKeyDown={handleKeyDown}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className="absolute top-2 px-4 pt-1 text-xs text-secondary"> Position Filter </span>
            <div className="flex items-center justify-between px-3 pt-6">
              {selectedAsset ? (
                <div className="flex items-center gap-2 pt-1">
                  <TokenIcon
                    address={selectedAsset.address}
                    chainId={selectedAsset.chainId}
                    symbol={selectedAsset.symbol}
                    width={18}
                    height={18}
                  />
                  <span className="text-sm">{selectedAsset.symbol}</span>
                  <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                    <Image
                      src={getNetworkImg(selectedAsset.chainId) as string}
                      alt="network"
                      width="16"
                      height="16"
                      className="rounded-full"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-300">{getNetworkName(selectedAsset.chainId)}</span>
                  </div>
                </div>
              ) : (
                <span className="p-[2px] text-sm text-gray-400"> All positions</span>
              )}
              <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                <ChevronDownIcon />
              </span>
            </div>
          </div>
          {isOpen && (
            <div className="bg-surface absolute z-10 mt-1 min-w-64 rounded-sm shadow-lg">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search positions..."
                className="w-full border-none bg-transparent p-3 text-sm focus:outline-none"
              />
              <div className="relative">
                <ul
                  className="custom-scrollbar max-h-60 overflow-auto pb-12"
                  role="listbox"
                >
                  {filteredAssets.map((asset, idx) => (
                    <li
                      key={`${asset.symbol}-${asset.chainId}-${idx}`}
                      className={`m-2 flex cursor-pointer items-center justify-between rounded-md p-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-700 ${
                        selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId
                          ? 'bg-gray-300 dark:bg-gray-700'
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedAsset(asset);
                        setIsOpen(false);
                        setQuery('');
                        setCurrentPage(1);
                      }}
                      role="option"
                      aria-selected={selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedAsset(asset);
                          setIsOpen(false);
                          setQuery('');
                          setCurrentPage(1);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <TokenIcon
                          address={asset.address}
                          chainId={asset.chainId}
                          symbol={asset.symbol}
                          width={18}
                          height={18}
                        />
                        <span>{asset.symbol}</span>
                        <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                          <Image
                            src={getNetworkImg(asset.chainId) as string}
                            alt="network"
                            width="16"
                            height="16"
                            className="rounded-full"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-300">{getNetworkName(asset.chainId)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="bg-surface absolute bottom-0 left-0 right-0 border-gray-700 p-2">
                  <button
                    className="hover:bg-main flex w-full items-center justify-between rounded-sm p-2 text-left text-xs text-secondary"
                    onClick={() => {
                      setSelectedAsset(null);
                      setQuery('');
                      setIsOpen(false);
                      setCurrentPage(1);
                    }}
                    type="button"
                  >
                    <span>Clear Filter</span>
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isGroupedView && (
        <div className="rounded bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <div className="flex items-start gap-2">
            <MdWarning
              size={18}
              className="text-yellow-700 dark:text-yellow-300 flex-shrink-0 mt-0.5"
            />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Grouped view may show incomplete groups near page boundaries. Increase entries per page for more accurate grouping.
            </p>
          </div>
        </div>
      )}

      <TableContainerWithHeader
        title="Transaction History"
        actions={headerActions}
      >
        <Table>
          <TableHeader>
            <TableRow className="text-secondary">
              {!isVaultAdapter && (
                <TableHead
                  className="z-50 text-center"
                  style={{ minWidth: '100px' }}
                >
                  Loan Asset
                </TableHead>
              )}
              <TableHead
                className="z-50 text-center"
                style={{ minWidth: '140px' }}
              >
                Market
              </TableHead>
              <TableHead
                className="z-50 text-center"
                style={{ minWidth: '80px' }}
              >
                Side
              </TableHead>
              <TableHead
                className="z-50 text-right"
                style={{ minWidth: '120px' }}
              >
                Amount
              </TableHead>
              <TableHead
                className="z-50 text-center"
                style={{ minWidth: '120px' }}
              >
                Tx Hash
              </TableHead>
              <TableHead
                className="z-50 text-right"
                style={{ minWidth: '90px' }}
              >
                Time
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {!isInitialized || loading ? (
              renderSkeletonRows(8)
            ) : (isGroupedView ? groupedHistory : ungroupedHistory).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isVaultAdapter ? 5 : 6}
                  className="text-center text-gray-400"
                >
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              (isGroupedView ? groupedHistory : ungroupedHistory).map((group, index) => {
                // Handle rebalances (expandable)
                if (isGroupedView && group.isMetaAction && group.metaActionType === 'rebalance') {
                  const firstTx = group.transactions[0];
                  const market = allMarkets.find((m) => m.uniqueKey === firstTx.data.market.uniqueKey) as Market | undefined;
                  const rowKey = `rebalance-${group.hash}`;
                  const isExpanded = expandedRows.has(rowKey);

                  return (
                    <React.Fragment key={group.hash}>
                      <TableRow
                        className="cursor-pointer hover:bg-hovered"
                        onClick={() => toggleRow(rowKey)}
                      >
                        {/* Loan Asset - only show if not vault adapter */}
                        {!isVaultAdapter && (
                          <TableCell
                            data-label="Loan Asset"
                            className="z-50"
                            style={{ minWidth: '100px' }}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {market && (
                                <>
                                  <TokenIcon
                                    address={market.loanAsset.address}
                                    chainId={market.morphoBlue.chain.id}
                                    symbol={market.loanAsset.symbol}
                                    width={16}
                                    height={16}
                                  />
                                  <span className="text-sm whitespace-nowrap">{getTruncatedAssetName(market.loanAsset.symbol)}</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}

                        {/* Market - show count of markets */}
                        <TableCell
                          data-label="Market"
                          className="z-50 text-center"
                          style={{ minWidth: '140px' }}
                        >
                          <span className="text-sm text-secondary">{group.transactions.length} markets</span>
                        </TableCell>

                        {/* Side - Rebalance badge */}
                        <TableCell
                          data-label="Side"
                          className="z-50 text-center"
                          style={{ minWidth: '80px' }}
                        >
                          <span className="inline-flex items-center rounded bg-hovered px-2 py-1 text-xs text-primary">Rebalance</span>
                        </TableCell>

                        {/* Amount - show rebalance amount */}
                        <TableCell
                          data-label="Amount"
                          className="z-50 text-right"
                          style={{ minWidth: '120px' }}
                        >
                          {group.amount && market ? (
                            <span className="text-sm">
                              {formatReadable(Number(formatUnits(group.amount, market.loanAsset.decimals)))}{' '}
                              {getTruncatedAssetName(market.loanAsset.symbol)}
                            </span>
                          ) : (
                            <span className="text-sm text-secondary">{group.transactions.length} actions</span>
                          )}
                        </TableCell>

                        {/* Transaction Hash */}
                        <TableCell
                          data-label="Tx Hash"
                          className="z-50"
                          style={{ minWidth: '120px' }}
                        >
                          <div className="flex justify-center">
                            <TransactionIdentity
                              txHash={group.hash}
                              chainId={market?.morphoBlue.chain.id ?? 1}
                            />
                          </div>
                        </TableCell>

                        {/* Time */}
                        <TableCell
                          data-label="Time"
                          className="z-50 text-right"
                          style={{ minWidth: '90px' }}
                        >
                          <span className="text-xs text-secondary whitespace-nowrap">{formatTimeAgo(group.timestamp)}</span>
                        </TableCell>
                      </TableRow>

                      {/* Expandable detail for rebalance */}
                      <AnimatePresence>
                        {isExpanded && (
                          <TableRow className="bg-surface [&:hover]:border-transparent [&:hover]:bg-surface">
                            <TableCell
                              colSpan={isVaultAdapter ? 5 : 6}
                              className="bg-surface"
                            >
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                transition={{ duration: 0.1 }}
                                className="overflow-hidden"
                              >
                                <RebalanceDetail groupedTransaction={group} />
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                }

                // Handle multiple deposits
                if (isGroupedView && group.isMetaAction && group.metaActionType === 'deposits') {
                  const firstTx = group.transactions[0];
                  const market = allMarkets.find((m) => m.uniqueKey === firstTx.data.market.uniqueKey) as Market | undefined;
                  const marketCount = new Set(group.transactions.map((t) => t.data.market.uniqueKey)).size;

                  return (
                    <TableRow
                      key={group.hash}
                      className="hover:bg-hovered"
                    >
                      {!isVaultAdapter && market && (
                        <TableCell
                          className="z-50"
                          style={{ minWidth: '100px' }}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <TokenIcon
                              address={market.loanAsset.address}
                              chainId={market.morphoBlue.chain.id}
                              symbol={market.loanAsset.symbol}
                              width={16}
                              height={16}
                            />
                            <span className="text-sm whitespace-nowrap">{getTruncatedAssetName(market.loanAsset.symbol)}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell
                        className="z-50 text-center"
                        style={{ minWidth: '140px' }}
                      >
                        <span className="text-sm text-secondary">
                          {marketCount} {marketCount === 1 ? 'market' : 'markets'}
                        </span>
                      </TableCell>
                      <TableCell
                        className="z-50 text-center"
                        style={{ minWidth: '80px' }}
                      >
                        <span className="inline-flex items-center rounded bg-hovered px-2 py-1 text-xs text-green-500">Deposits</span>
                      </TableCell>
                      <TableCell
                        className="z-50 text-right"
                        style={{ minWidth: '120px' }}
                      >
                        {group.amount && market ? (
                          <span className="text-sm">
                            +{formatReadable(Number(formatUnits(group.amount, market.loanAsset.decimals)))}{' '}
                            {getTruncatedAssetName(market.loanAsset.symbol)}
                          </span>
                        ) : (
                          <span className="text-sm text-secondary">{group.transactions.length} actions</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="z-50"
                        style={{ minWidth: '120px' }}
                      >
                        <div className="flex justify-center">
                          <TransactionIdentity
                            txHash={group.hash}
                            chainId={market?.morphoBlue.chain.id ?? 1}
                          />
                        </div>
                      </TableCell>
                      <TableCell
                        className="z-50 text-right"
                        style={{ minWidth: '90px' }}
                      >
                        <span className="text-xs text-secondary whitespace-nowrap">{formatTimeAgo(group.timestamp)}</span>
                      </TableCell>
                    </TableRow>
                  );
                }

                // Handle multiple withdrawals
                if (isGroupedView && group.isMetaAction && group.metaActionType === 'withdrawals') {
                  const firstTx = group.transactions[0];
                  const market = allMarkets.find((m) => m.uniqueKey === firstTx.data.market.uniqueKey) as Market | undefined;
                  const marketCount = new Set(group.transactions.map((t) => t.data.market.uniqueKey)).size;

                  return (
                    <TableRow
                      key={group.hash}
                      className="hover:bg-hovered"
                    >
                      {!isVaultAdapter && market && (
                        <TableCell
                          className="z-50"
                          style={{ minWidth: '100px' }}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <TokenIcon
                              address={market.loanAsset.address}
                              chainId={market.morphoBlue.chain.id}
                              symbol={market.loanAsset.symbol}
                              width={16}
                              height={16}
                            />
                            <span className="text-sm whitespace-nowrap">{getTruncatedAssetName(market.loanAsset.symbol)}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell
                        className="z-50 text-center"
                        style={{ minWidth: '140px' }}
                      >
                        <span className="text-sm text-secondary">
                          {marketCount} {marketCount === 1 ? 'market' : 'markets'}
                        </span>
                      </TableCell>
                      <TableCell
                        className="z-50 text-center"
                        style={{ minWidth: '80px' }}
                      >
                        <span className="inline-flex items-center rounded bg-hovered px-2 py-1 text-xs text-red-500">Withdrawals</span>
                      </TableCell>
                      <TableCell
                        className="z-50 text-right"
                        style={{ minWidth: '120px' }}
                      >
                        {group.amount && market ? (
                          <span className="text-sm">
                            -{formatReadable(Number(formatUnits(group.amount, market.loanAsset.decimals)))}{' '}
                            {getTruncatedAssetName(market.loanAsset.symbol)}
                          </span>
                        ) : (
                          <span className="text-sm text-secondary">{group.transactions.length} actions</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="z-50"
                        style={{ minWidth: '120px' }}
                      >
                        <div className="flex justify-center">
                          <TransactionIdentity
                            txHash={group.hash}
                            chainId={market?.morphoBlue.chain.id ?? 1}
                          />
                        </div>
                      </TableCell>
                      <TableCell
                        className="z-50 text-right"
                        style={{ minWidth: '90px' }}
                      >
                        <span className="text-xs text-secondary whitespace-nowrap">{formatTimeAgo(group.timestamp)}</span>
                      </TableCell>
                    </TableRow>
                  );
                }

                // Handle regular transactions (single transaction)
                const tx = group.transactions[0];
                return renderSingleTransactionRow(tx, index);
              })
            )}
          </TableBody>
        </Table>

        {isInitialized && !loading && totalPages > 1 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalEntries={totalPages * pageSize}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            isLoading={loading}
          />
        )}
      </TableContainerWithHeader>

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onOpenChange={onSettingsOpenChange}
        size="md"
        backdrop="opaque"
        zIndex="settings"
      >
        {(close) => (
          <>
            <ModalHeader
              variant="compact"
              title="View Settings"
              description="Configure how transaction history is displayed"
              mainIcon={<GearIcon />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="flex flex-col gap-4"
            >
              <FilterSection
                title="View Mode"
                helper="Group related transactions for easier viewing"
              >
                <FilterRow
                  title="Group Transactions"
                  description="Group rebalances and multiple deposits/withdrawals together"
                >
                  <IconSwitch
                    selected={isGroupedView}
                    onChange={setIsGroupedView}
                    size="xs"
                  />
                </FilterRow>
              </FilterSection>

              <Divider />

              <FilterSection
                title="Pagination"
                helper="Number of transactions shown per page"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="font-zen text-sm font-medium text-primary">Entries Per Page</span>
                    <span className="font-zen text-xs text-secondary">Higher values reduce pagination issues in grouped view</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      aria-label="Entries per page"
                      type="number"
                      placeholder="10"
                      value={customPageSize}
                      onChange={(e) => setCustomPageSize(e.target.value)}
                      min="1"
                      size="sm"
                      className="w-24"
                      onKeyDown={(e) => e.key === 'Enter' && handlePageSizeUpdate()}
                    />
                    <Button
                      size="sm"
                      onClick={handlePageSizeUpdate}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              </FilterSection>
            </ModalBody>
            <ModalFooter className="justify-end">
              <Button
                color="primary"
                size="sm"
                onClick={close}
              >
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}

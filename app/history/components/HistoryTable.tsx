import React from 'react';
import { useMemo, useState, useRef, useEffect } from 'react';
import { Chip, Link, Pagination } from '@nextui-org/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon, ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import moment from 'moment';
import Image from 'next/image';
import { RiRobot2Line } from 'react-icons/ri';
import { formatUnits } from 'viem';
import { Badge } from '@/components/common/Badge';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { useMarkets } from '@/contexts/MarketsContext';
import useUserTransactions from '@/hooks/useUserTransactions';
import { formatReadable } from '@/utils/balance';
import { getExplorerTxURL } from '@/utils/external';
import { actionTypeToText } from '@/utils/morpho';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import {
  UserTxTypes,
  UserRebalancerInfo,
  Market,
  MarketPosition,
  UserTransaction,
} from '@/utils/types';

type HistoryTableProps = {
  account: string | undefined;
  positions: MarketPosition[];
  rebalancerInfo?: UserRebalancerInfo;
};

type AssetKey = {
  symbol: string;
  chainId: number;
  img?: string;
};

export function HistoryTable({ account, positions, rebalancerInfo }: HistoryTableProps) {
  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { markets } = useMarkets();

  const { loading, fetchTransactions } = useUserTransactions();
  const [currentPage, setCurrentPage] = useState(1);
  const [history, setHistory] = useState<UserTransaction[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 10;

  // Get unique assets with their chain IDs
  const uniqueAssets = useMemo(() => {
    const assetMap = new Map<string, AssetKey>();
    positions.forEach((pos) => {
      const market = markets.find((m) => m.uniqueKey === pos.market.uniqueKey);
      if (!market) return;

      const key = `${market.loanAsset.symbol}-${market.morphoBlue.chain.id}`;
      if (!assetMap.has(key)) {
        const token = findToken(market.loanAsset.address, market.morphoBlue.chain.id);
        assetMap.set(key, {
          symbol: market.loanAsset.symbol,
          chainId: market.morphoBlue.chain.id,
          img: token?.img,
        });
      }
    });
    return Array.from(assetMap.values());
  }, [positions, markets]);

  // Get filtered market IDs based on selected asset
  const filteredMarketIds = useMemo(() => {
    if (!selectedAsset) return markets.map((m) => m.uniqueKey);

    return markets
      .filter(
        (m) =>
          m.loanAsset.symbol === selectedAsset.symbol &&
          m.morphoBlue.chain.id === selectedAsset.chainId,
      )
      .map((m) => m.uniqueKey);
  }, [selectedAsset, markets]);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!account || !fetchTransactions) return;

      const result = await fetchTransactions({
        userAddress: [account],
        first: pageSize,
        skip: (currentPage - 1) * pageSize,
        marketUniqueKeys: filteredMarketIds,
      });

      if (result) {
        setHistory(result.items);
        setTotalPages(Math.ceil(result.pageInfo.countTotal / pageSize));
      }
      setIsInitialized(true);
    };

    void loadTransactions();
  }, [markets, account, currentPage, fetchTransactions, filteredMarketIds]);

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

  const filteredAssets = uniqueAssets.filter((asset) =>
    asset.symbol.toLowerCase().includes(query.toLowerCase()),
  );

  const toggleDropdown = () => setIsOpen(!isOpen);

  return (
    <div className="space-y-4">
      <div className="relative w-full" ref={dropdownRef}>
        <div
          className={`bg-surface min-w-48 cursor-pointer rounded-sm p-2 shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
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
                {selectedAsset.img && (
                  <Image
                    src={selectedAsset.img}
                    alt={selectedAsset.symbol}
                    width={18}
                    height={18}
                    className="rounded-full"
                  />
                )}
                <span className="text-sm">{selectedAsset.symbol}</span>
                <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                  <Image
                    src={getNetworkImg(selectedAsset.chainId) as string}
                    alt="network"
                    width="16"
                    height="16"
                    className="rounded-full"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {getNetworkName(selectedAsset.chainId)}
                  </span>
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
          <div className="bg-surface absolute z-10 mt-1 w-full rounded-sm shadow-lg">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search positions..."
              className="w-full border-none bg-transparent p-3 text-sm focus:outline-none"
            />
            <div className="relative">
              <ul className="custom-scrollbar max-h-60 overflow-auto pb-12" role="listbox">
                {filteredAssets.map((asset) => (
                  <li
                    key={`${asset.symbol}-${asset.chainId}`}
                    className={`m-2 flex cursor-pointer items-center justify-between rounded-md p-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-700 ${
                      selectedAsset?.symbol === asset.symbol &&
                      selectedAsset?.chainId === asset.chainId
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
                    aria-selected={
                      selectedAsset?.symbol === asset.symbol &&
                      selectedAsset?.chainId === asset.chainId
                    }
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
                      {asset.img && (
                        <Image
                          src={asset.img}
                          alt={asset.symbol}
                          width={18}
                          height={18}
                          className="rounded-full"
                        />
                      )}
                      <span>{asset.symbol}</span>
                      <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                        <Image
                          src={getNetworkImg(asset.chainId) as string}
                          alt="network"
                          width="16"
                          height="16"
                          className="rounded-full"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {getNetworkName(asset.chainId)}
                        </span>
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

      {!isInitialized || loading ? (
        <LoadingScreen message="Loading transactions..." />
      ) : (
        <Table
          classNames={{
            th: 'bg-surface',
            wrapper: 'rounded-none shadow-none bg-surface p-6',
          }}
          bottomContent={
            totalPages > 1 ? (
              <div className="flex w-full justify-center">
                <Pagination
                  className="text-black"
                  isCompact
                  showControls
                  color="default"
                  page={currentPage}
                  total={totalPages}
                  onChange={setCurrentPage}
                />
              </div>
            ) : null
          }
        >
          <TableHeader className="table-header">
            <TableColumn className="text-left">Asset & Network</TableColumn>
            <TableColumn className="text-left">Market Details</TableColumn>
            <TableColumn className="text-center">Action & Amount</TableColumn>
            <TableColumn className="text-center">Time</TableColumn>
            <TableColumn className="text-center">Transaction</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No transactions found">
            {history.map((tx, index) => {
              // safely cast here because we only fetch txs for unique id in "markets"
              const market = markets.find(
                (m) => m.uniqueKey === tx.data.market.uniqueKey,
              ) as Market;

              const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);
              const collateralToken = findToken(
                market.collateralAsset.address,
                market.morphoBlue.chain.id,
              );
              const networkImg = getNetworkImg(market.morphoBlue.chain.id);
              const networkName = getNetworkName(market.morphoBlue.chain.id);
              const sign = tx.type === UserTxTypes.MarketSupply ? '+' : '-';
              const lltv = Number(formatUnits(BigInt(market.lltv), 18)) * 100;

              const isAgent = rebalancerInfo?.transactions.some(
                (agentTx) => agentTx.transactionHash === tx.hash,
              );

              return (
                <TableRow key={index.toFixed()}>
                  {/* Network & Asset */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {loanToken?.img && (
                          <Image
                            src={loanToken.img}
                            alt={market.loanAsset.symbol}
                            width="20"
                            height="20"
                            className="rounded-full"
                          />
                        )}
                        <span className="text-default-600">{market.loanAsset.symbol}</span>
                      </div>
                      <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                        {networkImg && (
                          <Image
                            src={networkImg}
                            alt="network"
                            width="16"
                            height="16"
                            className="rounded-full"
                          />
                        )}
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {networkName}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Market Details */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
                        className="font-monospace text-xs hover:underline"
                      >
                        {market.uniqueKey.slice(2, 8)}
                      </Link>
                      <div className="flex items-center gap-1">
                        {collateralToken?.img && (
                          <Image
                            src={collateralToken.img}
                            alt="collateral"
                            width="16"
                            height="16"
                            className="rounded-full"
                          />
                        )}
                        <span className="text-sm text-default-500">
                          {market.collateralAsset.symbol}
                        </span>
                      </div>
                      <Chip size="sm" variant="flat" className="bg-default-100 text-xs" radius="sm">
                        {formatReadable(lltv)}%
                      </Chip>
                    </div>
                  </TableCell>

                  {/* Action & Amount */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-medium">{actionTypeToText(tx.type)}</span>
                      <span
                        className={
                          tx.type === UserTxTypes.MarketSupply ? 'text-success' : 'text-danger'
                        }
                      >
                        {sign}
                        {formatReadable(
                          Number(formatUnits(BigInt(tx.data.assets), market.loanAsset.decimals)),
                        )}{' '}
                        {market.loanAsset.symbol}
                      </span>
                      {isAgent && (
                        <Badge size="sm">
                          <RiRobot2Line />
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Time */}
                  <TableCell>
                    <div className="flex justify-center text-sm text-default-500">
                      {moment.unix(tx.timestamp).fromNow()}
                    </div>
                  </TableCell>

                  {/* Transaction */}
                  <TableCell>
                    <div className="flex justify-center">
                      <Link
                        href={getExplorerTxURL(tx.hash, market.morphoBlue.chain.id)}
                        target="_blank"
                        className="flex items-center gap-1 text-sm hover:underline"
                      >
                        {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                        <ExternalLinkIcon />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

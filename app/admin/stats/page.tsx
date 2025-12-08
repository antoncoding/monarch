'use client';

import { useState, useEffect } from 'react';
import { Button } from '@heroui/react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import Image from 'next/image';
import { FiChevronDown } from 'react-icons/fi';
import ButtonGroup from '@/components/ButtonGroup';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarkets } from '@/contexts/MarketsContext';
import { fetchAllStatistics } from '@/services/statsService';
import { SupportedNetworks, getNetworkImg, getNetworkName, getViemChain } from '@/utils/networks';
import type { PlatformStats, TimeFrame, AssetVolumeData, Transaction } from '@/utils/statsUtils';
import type { ERC20Token, UnknownERC20Token, TokenSource } from '@/utils/tokens';
import { findToken as findTokenStatic } from '@/utils/tokens';
import { AssetMetricsTable } from './components/AssetMetricsTable';
import { StatsOverviewCards } from './components/StatsOverviewCards';
import { TransactionsTable } from './components/TransactionsTable';

const getAPIEndpoint = (network: SupportedNetworks) => {
  switch (network) {
    case SupportedNetworks.Base:
      return 'https://api.studio.thegraph.com/query/94369/monarch-metrics/version/latest';
    case SupportedNetworks.Mainnet:
      return 'https://api.studio.thegraph.com/query/110397/monarch-metrics-mainnet/version/latest';
    default:
      return undefined;
  }
};

export default function StatsPage() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('30D');
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks>(SupportedNetworks.Base);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLoanAssets, setSelectedLoanAssets] = useState<string[]>([]);
  const [selectedSides, setSelectedSides] = useState<('Supply' | 'Withdraw')[]>([]);
  const [uniqueLoanAssets, setUniqueLoanAssets] = useState<(ERC20Token | UnknownERC20Token)[]>([]);
  const [stats, setStats] = useState<{
    platformStats: PlatformStats;
    assetMetrics: AssetVolumeData[];
    transactions: Transaction[];
  }>({
    platformStats: {
      uniqueUsers: 0,
      uniqueUsersDelta: 0,
      totalTransactions: 0,
      totalTransactionsDelta: 0,
      supplyCount: 0,
      supplyCountDelta: 0,
      withdrawCount: 0,
      withdrawCountDelta: 0,
      activeMarkets: 0,
    },
    assetMetrics: [],
    transactions: [],
  });

  const { allMarkets } = useMarkets();

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        console.log(`Fetching statistics for timeframe: ${timeframe}, network: ${getNetworkName(selectedNetwork) ?? 'Unknown'}`);
        const startTime = performance.now();

        // Get API endpoint for the selected network
        const apiEndpoint = getAPIEndpoint(selectedNetwork);
        if (!apiEndpoint) {
          throw new Error(`Unsupported network: ${selectedNetwork}`);
        }
        console.log(`Using API endpoint: ${apiEndpoint}`);

        const allStats = await fetchAllStatistics(selectedNetwork, apiEndpoint, timeframe);

        const endTime = performance.now();
        console.log(`Statistics fetched in ${endTime - startTime}ms:`, allStats);

        console.log('Platform stats:', allStats.platformStats);
        console.log('Asset metrics count:', allStats.assetMetrics.length);

        setStats({
          platformStats: allStats.platformStats,
          assetMetrics: allStats.assetMetrics,
          transactions: allStats.transactions,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadStats();
  }, [timeframe, selectedNetwork]);

  // Extract unique loan assets from transactions
  useEffect(() => {
    if (stats.transactions.length === 0) {
      setUniqueLoanAssets([]);
      return;
    }

    const loanAssetsMap = new Map<string, { address: string; symbol: string; decimals: number }>();

    stats.transactions.forEach((tx) => {
      // Extract from supplies
      tx.supplies?.forEach((supply) => {
        if (supply.market?.loan) {
          const address = supply.market.loan.toLowerCase();
          if (!loanAssetsMap.has(address)) {
            const token = findTokenStatic(address, selectedNetwork);
            if (token) {
              loanAssetsMap.set(address, {
                address,
                symbol: token.symbol,
                decimals: token.decimals,
              });
            }
          }
        }
      });

      // Extract from withdrawals
      tx.withdrawals?.forEach((withdrawal) => {
        if (withdrawal.market?.loan) {
          const address = withdrawal.market.loan.toLowerCase();
          if (!loanAssetsMap.has(address)) {
            const token = findTokenStatic(address, selectedNetwork);
            if (token) {
              loanAssetsMap.set(address, {
                address,
                symbol: token.symbol,
                decimals: token.decimals,
              });
            }
          }
        }
      });
    });

    // Convert to ERC20Token format
    const tokens: ERC20Token[] = Array.from(loanAssetsMap.values()).map((asset) => {
      const fullToken = findTokenStatic(asset.address, selectedNetwork);
      return {
        symbol: asset.symbol,
        img: fullToken?.img,
        decimals: asset.decimals,
        networks: [
          {
            chain: getViemChain(selectedNetwork),
            address: asset.address,
          },
        ],
        source: 'local' as TokenSource,
      };
    });

    setUniqueLoanAssets(tokens);
  }, [stats.transactions, selectedNetwork]);

  const timeframeOptions = [
    { key: '1D', label: '1D', value: '1D' },
    { key: '7D', label: '7D', value: '7D' },
    { key: '30D', label: '30D', value: '30D' },
    { key: '90D', label: '90D', value: '90D' },
    { key: 'ALL', label: 'ALL', value: 'ALL' },
  ];

  // Get network image for selected network with fallback
  const selectedNetworkImg = getNetworkImg(selectedNetwork);
  // Get network names
  const baseNetworkName = getNetworkName(SupportedNetworks.Base);
  const mainnetNetworkName = getNetworkName(SupportedNetworks.Mainnet);

  return (
    <div className="container mx-auto px-4 py-8 font-inter">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-zen text-2xl font-bold">Platform Statistics</h1>
        <div className="flex items-center gap-4">
          {/* Network selector */}
          <Dropdown>
            <DropdownTrigger>
              <Button
                variant="flat"
                endContent={<FiChevronDown className="text-small" />}
                className="bg-surface min-w-[140px] border border-divider font-zen hover:bg-default-100 active:bg-default-200"
                startContent={
                  <div className="flex items-center">
                    {selectedNetworkImg && (
                      <Image
                        src={selectedNetworkImg as string}
                        alt={getNetworkName(selectedNetwork) ?? 'Network'}
                        width={20}
                        height={20}
                        className="mr-2"
                      />
                    )}
                  </div>
                }
              >
                {getNetworkName(selectedNetwork) ?? 'Network'}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Network Selection"
              onAction={(key) => setSelectedNetwork(Number(key) as SupportedNetworks)}
              className="font-zen"
            >
              <DropdownItem
                key={SupportedNetworks.Base}
                startContent={
                  getNetworkImg(SupportedNetworks.Base) && (
                    <Image
                      src={getNetworkImg(SupportedNetworks.Base) as string}
                      alt={baseNetworkName ?? 'Base Network'}
                      width={20}
                      height={20}
                    />
                  )
                }
                className="py-2"
              >
                {baseNetworkName}
              </DropdownItem>
              <DropdownItem
                key={SupportedNetworks.Mainnet}
                startContent={
                  getNetworkImg(SupportedNetworks.Mainnet) && (
                    <Image
                      src={getNetworkImg(SupportedNetworks.Mainnet) as string}
                      alt={mainnetNetworkName ?? 'Mainnet Network'}
                      width={20}
                      height={20}
                    />
                  )
                }
                className="py-2"
              >
                {mainnetNetworkName}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          {/* Timeframe selector */}
          <ButtonGroup
            options={timeframeOptions}
            value={timeframe}
            onChange={(value) => setTimeframe(value as TimeFrame)}
            size="sm"
            variant="default"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 w-full items-center justify-center">
          <Spinner size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          <StatsOverviewCards
            stats={stats.platformStats}
            selectedNetwork={selectedNetwork}
          />
          <AssetMetricsTable data={stats.assetMetrics} />

          {/* Transaction Filters */}
          <div className="flex items-center gap-4">
            {/* Loan Asset Filter */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  endContent={<FiChevronDown className="text-small" />}
                  className="bg-surface min-w-[160px] border border-divider font-zen hover:bg-default-100 active:bg-default-200"
                >
                  {selectedLoanAssets.length === 0
                    ? 'All loan assets'
                    : selectedLoanAssets.length === 1
                      ? (uniqueLoanAssets.find((asset) => {
                          const assetKey = asset.networks.map((n) => `${n.address}-${n.chain.id}`).join('|');
                          return selectedLoanAssets.includes(assetKey);
                        })?.symbol ?? 'Selected')
                      : `${selectedLoanAssets.length} selected`}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Loan Asset Selection"
                selectionMode="multiple"
                selectedKeys={new Set(selectedLoanAssets)}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys) as string[];
                  setSelectedLoanAssets(selected);
                }}
                className="font-zen"
              >
                {uniqueLoanAssets.map((asset) => {
                  const assetKey = asset.networks.map((n) => `${n.address}-${n.chain.id}`).join('|');
                  const firstNetwork = asset.networks[0];

                  return (
                    <DropdownItem
                      key={assetKey}
                      className="py-2"
                      startContent={
                        <TokenIcon
                          address={firstNetwork.address}
                          chainId={firstNetwork.chain.id}
                          symbol={asset.symbol}
                          width={20}
                          height={20}
                        />
                      }
                    >
                      {asset.symbol}
                    </DropdownItem>
                  );
                })}
              </DropdownMenu>
            </Dropdown>

            {/* Side Filter */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  endContent={<FiChevronDown className="text-small" />}
                  className="bg-surface min-w-[140px] border border-divider font-zen hover:bg-default-100 active:bg-default-200"
                >
                  {selectedSides.length === 0
                    ? 'All sides'
                    : selectedSides.length === 1
                      ? selectedSides[0]
                      : `${selectedSides.length} selected`}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Side Selection"
                selectionMode="multiple"
                selectedKeys={new Set(selectedSides)}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys) as ('Supply' | 'Withdraw')[];
                  setSelectedSides(selected);
                }}
                className="font-zen"
              >
                <DropdownItem
                  key="Supply"
                  className="py-2"
                >
                  Supply
                </DropdownItem>
                <DropdownItem
                  key="Withdraw"
                  className="py-2"
                >
                  Withdraw
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          <TransactionsTable
            data={stats.transactions}
            selectedNetwork={selectedNetwork}
            selectedLoanAssets={selectedLoanAssets}
            selectedSides={selectedSides}
            allMarkets={allMarkets}
          />
        </div>
      )}
    </div>
  );
}

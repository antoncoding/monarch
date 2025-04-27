'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@nextui-org/button';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@nextui-org/dropdown';
import Image from 'next/image';
import { FiChevronDown } from 'react-icons/fi';
import ButtonGroup from '@/components/ButtonGroup';
import { Spinner } from '@/components/common/Spinner';
import { fetchAllStatistics } from '@/services/statsService';
import { SupportedNetworks, getNetworkImg, getNetworkName } from '@/utils/networks';
import { PlatformStats, TimeFrame, AssetVolumeData } from '@/utils/statsUtils';
import { AssetMetricsTable } from './components/AssetMetricsTable';
import { StatsOverviewCards } from './components/StatsOverviewCards';

const getAPIEndpoint = (network: SupportedNetworks) => {
  switch (network) {
    case SupportedNetworks.Base:
      return 'https://api.studio.thegraph.com/query/94369/monarch-metrics/version/latest';
    case SupportedNetworks.Mainnet:
      return 'https://api.studio.thegraph.com/query/94369/monarch-metrics-mainnet/version/latest';
    default:
      return undefined;
  }
};

export default function StatsPage() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('30D');
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks>(SupportedNetworks.Base);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{
    platformStats: PlatformStats;
    assetMetrics: AssetVolumeData[];
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
  });

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        console.log(
          `Fetching statistics for timeframe: ${timeframe}, network: ${
            getNetworkName(selectedNetwork) ?? 'Unknown'
          }`,
        );
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
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadStats();
  }, [timeframe, selectedNetwork]);

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
          <StatsOverviewCards stats={stats.platformStats} selectedNetwork={selectedNetwork} />
          <AssetMetricsTable data={stats.assetMetrics} selectedNetwork={selectedNetwork} />
        </div>
      )}
    </div>
  );
}

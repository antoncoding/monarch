'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import useUserPositions from '@/hooks/useUserPositions';
import { DatePicker } from '@nextui-org/react';
import { parseDate, getLocalTimeZone, CalendarDate, today } from '@internationalized/date';
import { useDateFormatter } from '@react-aria/i18n';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { findToken } from '@/utils/tokens';
import { usePositionReport } from '@/hooks/usePositionReport';
import { ReportTable } from './ReportTable';
import { Address } from 'viem';
import { getNetworkImg, getNetworkName } from '@/utils/networks';

type AssetKey = {
  symbol: string;
  chainId: number;
  img?: string;
  address: string;
};

export default function ReportContent({ account }: { account: Address }) {
  const { loading, data: positions, history } = useUserPositions(account, true);
  const [startDate, setStartDate] = useState<CalendarDate>(parseDate('2024-01-01'));
  const [endDate, setEndDate] = useState<CalendarDate>(parseDate('2024-12-01'));
  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  console.log("selectedAsset", selectedAsset)
  
  const formatter = useDateFormatter({ dateStyle: 'long' });

  // Calculate maximum allowed date (now - 1 minute)
  const maxDate = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - 1);
    return parseDate(now.toISOString().split('T')[0]);
  }, []);

  // Handle date changes with validation
  const handleStartDateChange = (date: CalendarDate) => {
    if (date > endDate) {
      setEndDate(date);
    }
    setStartDate(date);
  };

  const handleEndDateChange = (date: CalendarDate) => {
    if (date < startDate) {
      setStartDate(date);
    }
    if (date > maxDate) {
      setEndDate(maxDate);
    } else {
      setEndDate(date);
    }
  };

  // Get unique assets with their chain IDs
  const uniqueAssets = useMemo(() => {
    if (!positions) return [];
    const assetMap = new Map<string, AssetKey>();
    positions.forEach((position) => {
      const key = `${position.market.loanAsset.symbol}-${position.market.morphoBlue.chain.id}`;
      if (!assetMap.has(key)) {
        const token = findToken(
          position.market.loanAsset.address,
          position.market.morphoBlue.chain.id,
        );
        assetMap.set(key, {
          symbol: position.market.loanAsset.symbol,
          chainId: position.market.morphoBlue.chain.id,
          img: token?.img,
          address: position.market.loanAsset.address,
        });
      }
    });
    return Array.from(assetMap.values());
  }, [positions]);

  // Filter assets based on search query
  const filteredAssets = useMemo(() => {
    return uniqueAssets.filter((asset) =>
      asset.symbol.toLowerCase().includes(query.toLowerCase()),
    );
  }, [uniqueAssets, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { generateReport } = usePositionReport(
    positions || [],
    history || [],
    account,
    selectedAsset,
    startDate ? new Date(startDate.toDate(getLocalTimeZone())) : undefined,
    endDate ? new Date(endDate.toDate(getLocalTimeZone())) : undefined,
  );

  const handleGenerateReport = async () => {
    if (!startDate || !endDate || !selectedAsset) return;
    setIsGenerating(true);
    try {
      const reportData = await generateReport();
      setReport(reportData);
    } catch (error) {
      console.error('Error generating report:', error);
      // TODO: Add error handling UI
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedToken = useMemo(() => {
    if (!selectedAsset) return null;
    return findToken(selectedAsset.address, selectedAsset.chainId);
  }, [selectedAsset]);

  const NetworkIcon = ({ networkId }: { networkId: number }) => {
    const url = getNetworkImg(networkId);
    return (
      <Image
        src={url as string}
        alt={`networkId-${networkId}`}
        width={16}
        height={16}
        className="rounded-full"
      />
    );
  };

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <h1 className="py-4 font-zen text-2xl">Position Report</h1>

        {loading ? (
          <LoadingScreen message="Loading Positions..." />
        ) : positions.length === 0 ? (
          <div className="w-full items-center rounded-md p-12 text-center text-secondary">
            No positions available.
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-end sm:space-x-4 sm:space-y-0">
              {/* Asset Selector Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex h-[56px] cursor-pointer items-center justify-between rounded-md border border-gray-300 bg-white px-4"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  {selectedAsset ? (
                    <div className="flex items-center gap-2">
                      {selectedAsset.img && (
                        <Image
                          src={selectedAsset.img}
                          alt={selectedAsset.symbol}
                          width={20}
                          height={20}
                        />
                      )}
                      <span>{selectedAsset.symbol}</span>
                      <div className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                        <NetworkIcon networkId={selectedAsset.chainId} />
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {getNetworkName(selectedAsset.chainId)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">Select Asset</span>
                  )}
                  <ChevronDownIcon className="ml-2" />
                </div>

                {isOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
                    <input
                      type="text"
                      className="w-full border-b border-gray-300 p-2"
                      placeholder="Search assets..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="max-h-60 overflow-auto">
                      {filteredAssets.map((asset) => (
                        <div
                          key={`${asset.symbol}-${asset.chainId}`}
                          className="flex cursor-pointer items-center gap-2 p-2 hover:bg-gray-100"
                          onClick={() => {
                            setSelectedAsset(asset);
                            setIsOpen(false);
                            setQuery('');
                          }}
                        >
                          {asset.img && (
                            <Image src={asset.img} alt={asset.symbol} width={20} height={20} />
                          )}
                          <span>{asset.symbol}</span>
                          <div className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                            <NetworkIcon networkId={asset.chainId} />
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                              {getNetworkName(asset.chainId)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={handleStartDateChange}
                className="w-[284px] rounded-sm"
              />

              <DatePicker
                label="End Date"
                value={endDate}
                onChange={handleEndDateChange}
                className="w-[284px] rounded-sm"
                minValue={startDate}
                maxValue={maxDate}
              />

              <Button
                variant="solid"
                color="primary"
                className="h-[56px] px-6 font-zen rounded-sm"
                size="lg"
                onClick={handleGenerateReport}
                disabled={!startDate || !endDate || !selectedAsset || isGenerating}
              >
                Generate Report
              </Button>
            </div>

            <p className="text-default-500 text-sm">
              Selected date range:{' '}
              {startDate && endDate
                ? formatter.formatRange(
                    startDate.toDate(getLocalTimeZone()),
                    endDate.toDate(getLocalTimeZone())
                  )
                : '--'}
            </p>

            {isGenerating && <LoadingScreen message="Generating Report..." />}
            
            {report && selectedToken && <ReportTable report={report} asset={selectedToken} />}
          </div>
        )}
      </div>
    </div>
  );
}

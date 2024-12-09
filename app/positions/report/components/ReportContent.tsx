'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import useUserPositions from '@/hooks/useUserPositions';
import DatePicker from '@/components/common/DatePicker';
import { parseDate, getLocalTimeZone, CalendarDate, today } from '@internationalized/date';
import { useDateFormatter } from '@react-aria/i18n';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { findToken } from '@/utils/tokens';
import { usePositionReport } from '@/hooks/usePositionReport';
import { ReportTable } from './ReportTable';
import { Address } from 'viem';
import { getNetworkImg, getNetworkName, SupportedNetworks } from '@/utils/networks';
import { getMorphoGensisDate } from '@/utils/morpho';
import { DateValue } from '@nextui-org/react';
import { Spinner } from '@/components/common/Spinner';

type AssetKey = {
  symbol: string;
  chainId: number;
  img?: string;
  address: string;
};

export default function ReportContent({ account }: { account: Address }) {
  const { loading, data: positions, history } = useUserPositions(account, true);
  const [startDate, setStartDate] = useState<DateValue>(parseDate('2024-05-04'));
  const [endDate, setEndDate] = useState<DateValue>(parseDate('2024-12-01'));
  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatter = useDateFormatter({ dateStyle: 'long' });

  // Calculate minimum allowed date based on selected chain's genesis
  const minDate = useMemo(() => {
    const genesisDate = getMorphoGensisDate(selectedAsset?.chainId || SupportedNetworks.Mainnet);
    return parseDate(genesisDate.toISOString().split('T')[0]);
  }, [selectedAsset]);

  // Calculate maximum allowed date (today)
  const maxDate = useMemo(() => {
    return today(getLocalTimeZone());
  }, []);

  // Handle date changes with validation
  const handleStartDateChange = (date: DateValue) => {
    if (date > endDate) {
      setEndDate(date);
    }
    setStartDate(date);
  };

  const handleEndDateChange = (date: DateValue) => {
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
    return uniqueAssets.filter((asset) => asset.symbol.toLowerCase().includes(query.toLowerCase()));
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
            {/* Controls Row */}
            <div className="flex items-center justify-between">
              {/* Left side controls group */}
              <div className="flex items-center gap-4">
                {/* Asset Selector */}
                <div className="relative h-14" ref={dropdownRef}>
                  <div
                    className={`bg-surface h-full min-w-48 cursor-pointer rounded-sm p-2 shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
                      isOpen ? 'bg-surface-dark' : ''
                    }`}
                    onClick={() => setIsOpen(!isOpen)}
                  >
                    <span className="absolute left-2 top-2 px-1 text-xs">Asset</span>
                    <div className="flex h-full items-center justify-between pt-4">
                      {selectedAsset ? (
                        <div className="flex items-center gap-2 p-1">
                          {selectedAsset.img && (
                            <Image
                              src={selectedAsset.img}
                              alt={selectedAsset.symbol}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          )}
                          <span className="font-medium">{selectedAsset.symbol}</span>
                          <div className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
                            <NetworkIcon networkId={selectedAsset.chainId} />
                            <span className="text-gray-600 dark:text-gray-300">
                              {getNetworkName(selectedAsset.chainId)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="p-1 text-gray-500">Select Asset</span>
                      )}
                      <ChevronDownIcon className="ml-2 h-4 w-4 text-gray-500" />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-sm border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <div className="border-b border-gray-200 p-2 dark:border-gray-700">
                        <input
                          type="text"
                          className="w-full bg-transparent p-1 text-sm outline-none placeholder:text-gray-500"
                          placeholder="Search assets..."
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {filteredAssets.map((asset) => (
                          <div
                            key={`${asset.symbol}-${asset.chainId}`}
                            className="flex cursor-pointer items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setIsOpen(false);
                              setQuery('');
                            }}
                          >
                            {asset.img && (
                              <Image src={asset.img} alt={asset.symbol} width={20} height={20} />
                            )}
                            <span className="font-medium">{asset.symbol}</span>
                            <div className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
                              <NetworkIcon networkId={asset.chainId} />
                              <span className="text-gray-600 dark:text-gray-300">
                                {getNetworkName(asset.chainId)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Date Pickers */}
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  minValue={minDate}
                  maxValue={maxDate}
                />

                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  minValue={minDate}
                  maxValue={maxDate}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateReport}
                isDisabled={!selectedAsset || isGenerating}
                className="h-14 justify-center"
                variant="cta"
                endContent={isGenerating && <Spinner size={20}/>}
              >
                {'Generate'}
              </Button>
            </div>

            {/* Report Content */}
            <p className="text-sm text-default-500">
              Selected date range:{' '}
              {startDate && endDate
                ? formatter.formatRange(
                    startDate.toDate(getLocalTimeZone()),
                    endDate.toDate(getLocalTimeZone()),
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

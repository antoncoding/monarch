'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { parseDate, getLocalTimeZone, today } from '@internationalized/date';
import { DateValue } from '@nextui-org/react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useDateFormatter } from '@react-aria/i18n';
import Image from 'next/image';
import { Address } from 'viem';
import { Button } from '@/components/common/Button';
import DatePicker from '@/components/common/DatePicker';
import { NetworkIcon } from '@/components/common/NetworkIcon';
import { Spinner } from '@/components/common/Spinner';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { usePositionReport } from '@/hooks/usePositionReport';
import useUserPositions from '@/hooks/useUserPositions';
import { getMorphoGensisDate } from '@/utils/morpho';
import { getNetworkName, SupportedNetworks } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { ReportTable, ReportSummary } from './ReportTable';

type AssetKey = {
  symbol: string;
  address: Address;
  chainId: number;
  img?: string;
};

type ReportState = {
  asset: AssetKey;
  startDate: DateValue;
  endDate: DateValue;
  report: ReportSummary | null;
};

export default function ReportContent({ account }: { account: Address }) {
  const { loading, data: positions, history } = useUserPositions(account, true);
  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);
  const [startDate, setStartDate] = useState<DateValue>(parseDate('2024-05-04'));
  const [endDate, setEndDate] = useState<DateValue>(parseDate('2024-12-01'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportState, setReportState] = useState<ReportState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatter = useDateFormatter({ dateStyle: 'long' });

  // Calculate minimum allowed date based on selected chain's genesis
  const minDate = useMemo(() => {
    return selectedAsset
      ? parseDate(getMorphoGensisDate(selectedAsset.chainId).toISOString().split('T')[0])
      : today(getLocalTimeZone());
  }, [selectedAsset]);

  // Calculate maximum allowed date (today)
  const maxDate = today(getLocalTimeZone());

  // Check if current inputs match the report state
  const isReportCurrent = useMemo(() => {
    if (!reportState || !selectedAsset) return false;
    return (
      reportState.asset.address === selectedAsset.address &&
      reportState.asset.chainId === selectedAsset.chainId &&
      reportState.startDate === startDate &&
      reportState.endDate === endDate
    );
  }, [reportState, selectedAsset, startDate, endDate]);

  // Reset report when inputs change
  useEffect(() => {
    if (!reportState || !selectedAsset) return;

    // Reset report if inputs change
    if (
      reportState.asset.address !== selectedAsset.address ||
      reportState.startDate !== startDate ||
      reportState.endDate !== endDate
    ) {
      setReportState(null);
    }
  }, [selectedAsset, startDate, endDate, reportState]);

  // Handle input changes
  const handleAssetChange = (asset: AssetKey) => {
    setSelectedAsset(asset);
    setIsOpen(false);
    setQuery('');
  };

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
    setEndDate(date);
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
          address: position.market.loanAsset.address as Address,
          chainId: position.market.morphoBlue.chain.id,
          img: token?.img,
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

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedAsset || isGenerating || isReportCurrent) return;

    setIsGenerating(true);
    try {
      const reportData = await generateReport();
      setReportState({
        asset: selectedAsset,
        startDate,
        endDate,
        report: reportData,
      });
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

  // Validate dates
  const getDateError = useCallback(
    (date: DateValue, isStart: boolean) => {
      if (!date) return 'Date is required';
      if (date > maxDate) return 'Cannot select future date';
      if (isStart && date > endDate) return 'Start date cannot be after end date';
      if (!isStart && date < startDate) return 'End date cannot be before start date';
      if (selectedAsset) {
        const genesisDate = parseDate(
          getMorphoGensisDate(selectedAsset.chainId).toISOString().split('T')[0],
        );
        if (date < genesisDate)
          return `Date cannot be before ${formatter.format(
            genesisDate.toDate(getLocalTimeZone()),
          )}`;
      }
      return undefined;
    },
    [maxDate, startDate, endDate, selectedAsset, formatter],
  );

  const startDateError = useMemo(() => getDateError(startDate, true), [getDateError, startDate]);
  const endDateError = useMemo(() => getDateError(endDate, false), [getDateError, endDate]);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <h1 className="py-4 font-zen text-2xl">Position Report</h1>

        {loading ? (
          <LoadingScreen message="Loading User Info..." />
        ) : positions.length === 0 ? (
          <div className="w-full items-center rounded-md p-12 text-center text-secondary">
            No positions available.
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Controls Row */}
            <div className="flex h-[88px] items-start justify-between">
              {/* Left side controls group */}
              <div className="flex items-start gap-4">
                {/* Asset Selector */}
                <div className="relative h-14 min-w-[200px]" ref={dropdownRef}>
                  <button
                    className="flex h-14 items-center gap-2 rounded border border-gray-200 bg-white px-4 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 min-w-[200px]"
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setIsOpen(!isOpen);
                      }
                    }}
                    type="button"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                  >
                    {selectedAsset && (
                      <div
                        className="flex items-center gap-2"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(!isOpen);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                          }
                        }}
                      >
                        {selectedAsset.img && (
                          <Image
                            src={selectedAsset.img}
                            alt={selectedAsset.symbol}
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        )}
                        <span>{selectedAsset.symbol}</span>
                        <div className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
                          <NetworkIcon networkId={selectedAsset.chainId} />
                          <span className="text-gray-600 dark:text-gray-300">
                            {getNetworkName(selectedAsset.chainId)}
                          </span>
                        </div>
                      </div>
                    )}
                    <ChevronDownIcon className="ml-2 h-4 w-4" />
                  </button>

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
                              handleAssetChange(asset);
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
                  isInvalid={!!startDateError}
                  errorMessage={startDateError}
                />

                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  minValue={minDate}
                  maxValue={maxDate}
                  isInvalid={!!endDateError}
                  errorMessage={endDateError}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={() => {
                  void handleGenerateReport();
                }}
                isDisabled={
                  !selectedAsset ||
                  isGenerating ||
                  isReportCurrent ||
                  !!startDateError ||
                  !!endDateError
                }
                className="inline-flex h-14 min-w-[120px] items-center gap-2"
                variant="cta"
              >
                {isGenerating ? <Spinner size={20} color="currentColor" /> : 'Generate'}
              </Button>
            </div>

            {/* Report Content */}
            {reportState && (
              <ReportTable
                startDate={reportState.startDate}
                endDate={reportState.endDate}
                report={reportState.report}
                asset={selectedToken!}
                chainId={reportState.asset.chainId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

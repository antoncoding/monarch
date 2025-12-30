'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseDate, getLocalTimeZone, today, parseAbsoluteToLocal, type ZonedDateTime, now, type DateValue } from '@internationalized/date';
import { useDateFormatter } from '@react-aria/i18n';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import DatePicker from '@/components/shared/date-picker';
import { Spinner } from '@/components/ui/spinner';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/status/loading-screen';
import { usePositionReport } from '@/hooks/usePositionReport';
import type { ReportSummary } from '@/hooks/usePositionReport';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import useUserPositions from '@/hooks/useUserPositions';
import { getMorphoGenesisDate } from '@/utils/morpho';
import { AssetSelector, type AssetKey } from './components/asset-selector';
import { ReportTable } from './components/report-table';

type ReportState = {
  asset: AssetKey;
  startDate: DateValue;
  endDate: DateValue;
  report: ReportSummary | null;
};

export default function ReportContent({ account }: { account: Address }) {
  // Global markets loading state
  const { loading: isMarketsLoading } = useProcessedMarkets();

  // Fetch ALL positions including closed ones (onlySupplied: false)
  // This ensures report includes markets that were active during the selected period
  const { loading: isPositionsLoading, data: positions } = useUserPositions(account, true);

  // Combined loading state
  const loading = isMarketsLoading || isPositionsLoading;

  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);

  // Get today's date and 2 months ago
  const todayDate = useMemo(() => {
    const currentDate = now(getLocalTimeZone());
    return currentDate.set({ minute: 0, second: 0 });
  }, []);

  const twoMonthsAgo = useMemo(() => {
    const date = now(getLocalTimeZone()).subtract({ months: 2 });
    date.set({ minute: 0, second: 0 });
    return date;
  }, []);

  const [startDate, setStartDate] = useState<ZonedDateTime>(twoMonthsAgo);
  const [endDate, setEndDate] = useState<ZonedDateTime>(todayDate);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportState, setReportState] = useState<ReportState | null>(null);
  const formatter = useDateFormatter({ dateStyle: 'long' });

  // Calculate minimum allowed date based on selected chain's genesis
  const minDate = useMemo(() => {
    return selectedAsset ? parseAbsoluteToLocal(getMorphoGenesisDate(selectedAsset.chainId).toISOString()) : today(getLocalTimeZone());
  }, [selectedAsset]);

  // Calculate maximum allowed date (today)
  const maxDate = useMemo(() => now(getLocalTimeZone()), []);

  // Reset report when inputs change
  useEffect(() => {
    if (!reportState || !selectedAsset) return;

    // Reset report if inputs change
    if (reportState.asset.address !== selectedAsset.address || reportState.startDate !== startDate || reportState.endDate !== endDate) {
      setReportState(null);
    }
  }, [selectedAsset, startDate, endDate, reportState]);

  // Handle input changes
  const handleAssetChange = (asset: AssetKey) => {
    setSelectedAsset(asset);
  };

  const handleStartDateChange = (date: ZonedDateTime) => {
    // Ensure time is set to exact hour
    const exactHourDate = date.set({ minute: 0, second: 0 });
    if (exactHourDate > endDate) {
      setEndDate(exactHourDate);
    }
    setStartDate(exactHourDate);
  };

  const handleEndDateChange = (date: ZonedDateTime) => {
    // Ensure time is set to exact hour
    const exactHourDate = date.set({ minute: 0, second: 0 });
    if (exactHourDate < startDate) {
      setStartDate(exactHourDate);
    }
    setEndDate(exactHourDate);
  };

  const { generateReport } = usePositionReport(positions || [], account, selectedAsset, startDate.toDate(), endDate.toDate());

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedAsset || isGenerating) return;

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

  // Validate dates
  const getDateError = useCallback(
    (date: DateValue, isStart: boolean) => {
      try {
        if (!date) return undefined;

        // Check against max date (today)
        if (maxDate && date.compare(maxDate) > 0) {
          return 'Cannot select future date';
        }

        // Check start vs end date relationship
        if (isStart && endDate && date.compare(endDate) > 0) {
          return 'Start date cannot be after end date';
        }
        if (!isStart && startDate && date.compare(startDate) < 0) {
          return 'End date cannot be before start date';
        }

        // Check against genesis date
        if (selectedAsset) {
          const genesisDate = parseDate(getMorphoGenesisDate(selectedAsset.chainId).toISOString().split('T')[0]);
          if (date.compare(genesisDate) < 0) {
            return `Date cannot be before ${formatter.format(genesisDate.toDate(getLocalTimeZone()))}`;
          }
        }

        return undefined;
      } catch (error) {
        console.error('Error validating date:', error);
        return undefined;
      }
    },
    [maxDate, startDate, endDate, selectedAsset, formatter],
  );

  const startDateError = useMemo(() => getDateError(startDate, true), [getDateError, startDate]);
  const endDateError = useMemo(() => getDateError(endDate, false), [getDateError, endDate]);

  const uniqueAssets = useMemo(() => {
    const assetMap = new Map<string, AssetKey>();

    positions.forEach((position) => {
      const key = `${position.market.loanAsset.address}-${position.market.morphoBlue.chain.id}`;
      if (!assetMap.has(key)) {
        assetMap.set(key, {
          symbol: position.market.loanAsset.symbol,
          address: position.market.loanAsset.address as Address,
          chainId: position.market.morphoBlue.chain.id,
          decimals: position.market.loanAsset.decimals,
        });
      }
    });

    return Array.from(assetMap.values());
  }, [positions]);

  // URL params for pre-population from history page
  const searchParams = useSearchParams();
  const hasInitializedFromUrl = useRef(false);

  // Initialize from URL params if provided (from history page navigation)
  useEffect(() => {
    if (hasInitializedFromUrl.current) return;
    if (positions.length === 0 || uniqueAssets.length === 0) return;

    const chainIdParam = searchParams.get('chainId');
    const tokenAddressParam = searchParams.get('tokenAddress');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Set asset from URL params
    if (chainIdParam && tokenAddressParam) {
      const chainId = Number.parseInt(chainIdParam, 10);
      const matchingAsset = uniqueAssets.find(
        (asset) => asset.chainId === chainId && asset.address.toLowerCase() === tokenAddressParam.toLowerCase(),
      );
      if (matchingAsset) {
        setSelectedAsset(matchingAsset);
      }
    }

    // Set dates from URL params
    if (startDateParam) {
      try {
        const parsed = parseAbsoluteToLocal(startDateParam);
        setStartDate(parsed);
      } catch {
        // Invalid date format, ignore
      }
    }

    if (endDateParam) {
      try {
        const parsed = parseAbsoluteToLocal(endDateParam);
        setEndDate(parsed);
      } catch {
        // Invalid date format, ignore
      }
    }

    hasInitializedFromUrl.current = true;
  }, [searchParams, positions.length, uniqueAssets]);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <h1 className="py-4 font-zen text-2xl">Position Report</h1>

        {loading ? (
          <LoadingScreen
            message={isMarketsLoading ? 'Loading markets...' : 'Loading positions...'}
            className="mt-6"
          />
        ) : positions.length === 0 ? (
          <div className="bg-surface mt-6 w-full items-center rounded p-12 text-center text-secondary">No positions available.</div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Controls Row */}
            <div className="flex items-start justify-between gap-4">
              {/* Left side controls group */}
              <div className="flex items-start gap-4">
                {/* Asset Selector */}
                <AssetSelector
                  selectedAsset={selectedAsset}
                  assets={uniqueAssets}
                  onSelect={handleAssetChange}
                  variant="compact"
                />

                {/* Date Pickers */}
                <DatePicker
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  value={startDate as any}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  onChange={handleStartDateChange as any}
                  minValue={minDate}
                  maxValue={maxDate}
                  isInvalid={!!startDateError}
                  errorMessage={startDateError}
                  granularity="hour"
                />

                <DatePicker
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  value={endDate as any}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  onChange={handleEndDateChange as any}
                  minValue={minDate}
                  maxValue={maxDate}
                  isInvalid={!!endDateError}
                  errorMessage={endDateError}
                  granularity="hour"
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={() => {
                  void handleGenerateReport();
                }}
                disabled={!selectedAsset || isGenerating || !!startDateError || !!endDateError}
                className="h-10 min-w-[100px]"
                variant="primary"
              >
                {isGenerating ? (
                  <Spinner
                    size={16}
                    color="currentColor"
                  />
                ) : (
                  'Generate'
                )}
              </Button>
            </div>

            {/* Report Content */}
            {reportState?.report && selectedAsset && (
              <ReportTable
                startDate={reportState.startDate}
                endDate={reportState.endDate}
                report={reportState.report}
                asset={selectedAsset as AssetKey}
                chainId={selectedAsset.chainId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  parseDate,
  getLocalTimeZone,
  today,
  parseAbsoluteToLocal,
  ZonedDateTime,
  now,
} from '@internationalized/date';
import { DateValue } from '@nextui-org/react';
import { useDateFormatter } from '@react-aria/i18n';
import { Address } from 'viem';
import { Button } from '@/components/common/Button';
import DatePicker from '@/components/common/DatePicker';
import { Spinner } from '@/components/common/Spinner';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { usePositionReport } from '@/hooks/usePositionReport';
import { ReportSummary } from '@/hooks/usePositionReport';
import useUserPositions from '@/hooks/useUserPositions';
import { getMorphoGensisDate } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';
import { AssetSelector, type AssetKey } from './AssetSelector';
import { ReportTable } from './ReportTable';

type ReportState = {
  asset: AssetKey;
  startDate: DateValue;
  endDate: DateValue;
  report: ReportSummary | null;
};

export default function ReportContent({ account }: { account: Address }) {
  const { loading, data: positions, history } = useUserPositions(account, true);
  const [selectedAsset, setSelectedAsset] = useState<AssetKey | null>(null);

  // Get today's date and 2 months ago
  const todayDate = now(getLocalTimeZone());
  const twoMonthsAgo = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    return parseAbsoluteToLocal(date.toISOString());
  }, []);

  const [startDate, setStartDate] = useState<ZonedDateTime>(twoMonthsAgo);
  const [endDate, setEndDate] = useState<ZonedDateTime>(todayDate);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportState, setReportState] = useState<ReportState | null>(null);
  const formatter = useDateFormatter({ dateStyle: 'long' });

  // Calculate minimum allowed date based on selected chain's genesis
  const minDate = useMemo(() => {
    return selectedAsset
      ? parseAbsoluteToLocal(getMorphoGensisDate(selectedAsset.chainId).toISOString())
      : today(getLocalTimeZone());
  }, [selectedAsset]);

  // Calculate maximum allowed date (today)
  const maxDate = useMemo(() => now(getLocalTimeZone()), []);

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
  };

  const handleStartDateChange = (date: ZonedDateTime) => {
    if (date > endDate) {
      setEndDate(date);
    }
    setStartDate(date);
  };

  const handleEndDateChange = (date: ZonedDateTime) => {
    if (date < startDate) {
      setStartDate(date);
    }
    setEndDate(date);
  };

  const { generateReport } = usePositionReport(
    positions || [],
    history || [],
    account,
    selectedAsset,
    startDate.toDate(),
    endDate.toDate(),
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

  const uniqueAssets = useMemo(() => {
    const assetMap = new Map<string, AssetKey>();

    positions.forEach((position) => {
      const key = `${position.market.loanAsset.address}-${position.market.morphoBlue.chain.id}`;
      if (!assetMap.has(key)) {
        const token = findToken(
          position.market.loanAsset.address as Address,
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
                <AssetSelector
                  selectedAsset={selectedAsset}
                  assets={uniqueAssets}
                  onSelect={handleAssetChange}
                />

                {/* Date Pickers */}
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  onChange={handleStartDateChange as any}
                  minValue={minDate}
                  maxValue={maxDate}
                  isInvalid={!!startDateError}
                  errorMessage={startDateError}
                  granularity="hour"
                />

                <DatePicker
                  label="End Date"
                  value={endDate}
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
            {reportState?.report && (
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

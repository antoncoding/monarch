'use client';

import { useState, useMemo, useCallback } from 'react';
import { now, getLocalTimeZone, parseAbsoluteToLocal, type ZonedDateTime, type DateValue } from '@internationalized/date';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import DatePicker from '@/components/shared/date-picker';
import { usePositionReport } from '@/hooks/usePositionReport';
import type { ReportSummary } from '@/hooks/usePositionReport';
import { getMorphoGenesisDate } from '@/utils/morpho';
import { ReportTable } from '@/features/positions-report/components/report-table';
import type { GroupedPosition } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type ReportTabProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  userAddress: string;
};

type ReportState = {
  startDate: DateValue;
  endDate: DateValue;
  report: ReportSummary | null;
};

type DateRangePreset = '7d' | '30d' | '90d' | 'all';

export function ReportTab({ groupedPosition, chainId, userAddress }: ReportTabProps) {
  // Calculate default dates (7 days ago to now)
  const todayDate = useMemo(() => {
    const currentDate = now(getLocalTimeZone());
    return currentDate.set({ minute: 0, second: 0 });
  }, []);

  const sevenDaysAgo = useMemo(() => {
    const date = now(getLocalTimeZone()).subtract({ days: 7 });
    return date.set({ minute: 0, second: 0 });
  }, []);

  const [startDate, setStartDate] = useState<ZonedDateTime>(sevenDaysAgo);
  const [endDate, setEndDate] = useState<ZonedDateTime>(todayDate);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportState, setReportState] = useState<ReportState | null>(null);
  const [activePreset, setActivePreset] = useState<DateRangePreset>('7d');

  // Calculate minimum allowed date based on chain's genesis
  const minDate = useMemo(() => {
    return parseAbsoluteToLocal(getMorphoGenesisDate(chainId).toISOString());
  }, [chainId]);

  const maxDate = useMemo(() => now(getLocalTimeZone()), []);

  // Convert grouped position markets to the format expected by usePositionReport
  const positions = useMemo(() => {
    return groupedPosition.markets.map((m) => ({
      market: m.market,
      state: m.state,
    }));
  }, [groupedPosition.markets]);

  // Asset info for the report
  const selectedAsset = useMemo(
    () => ({
      symbol: groupedPosition.loanAssetSymbol,
      address: groupedPosition.loanAssetAddress,
      chainId: chainId,
      decimals: groupedPosition.loanAssetDecimals,
    }),
    [groupedPosition, chainId],
  );

  const { generateReport } = usePositionReport(positions, userAddress as Address, selectedAsset, startDate.toDate(), endDate.toDate());

  // Handle date range presets
  const handlePresetChange = (preset: DateRangePreset) => {
    setActivePreset(preset);
    const currentDate = now(getLocalTimeZone()).set({ minute: 0, second: 0 });
    setEndDate(currentDate);

    let newStartDate: ZonedDateTime;
    switch (preset) {
      case '7d':
        newStartDate = currentDate.subtract({ days: 7 });
        break;
      case '30d':
        newStartDate = currentDate.subtract({ days: 30 });
        break;
      case '90d':
        newStartDate = currentDate.subtract({ days: 90 });
        break;
      case 'all':
        newStartDate = parseAbsoluteToLocal(getMorphoGenesisDate(chainId).toISOString());
        break;
      default:
        newStartDate = currentDate.subtract({ days: 7 });
    }
    setStartDate(newStartDate);
    // Reset report when dates change
    setReportState(null);
  };

  const handleStartDateChange = (date: ZonedDateTime) => {
    const exactHourDate = date.set({ minute: 0, second: 0 });
    if (exactHourDate > endDate) {
      setEndDate(exactHourDate);
    }
    setStartDate(exactHourDate);
    setActivePreset('7d'); // Reset preset when manually changing
    setReportState(null);
  };

  const handleEndDateChange = (date: ZonedDateTime) => {
    const exactHourDate = date.set({ minute: 0, second: 0 });
    if (exactHourDate < startDate) {
      setStartDate(exactHourDate);
    }
    setEndDate(exactHourDate);
    setActivePreset('7d'); // Reset preset when manually changing
    setReportState(null);
  };

  // Validate dates
  const getDateError = useCallback(
    (date: DateValue, isStart: boolean) => {
      try {
        if (!date) return undefined;

        if (maxDate && date.compare(maxDate) > 0) {
          return 'Cannot select future date';
        }

        if (isStart && endDate && date.compare(endDate) > 0) {
          return 'Start date cannot be after end date';
        }
        if (!isStart && startDate && date.compare(startDate) < 0) {
          return 'End date cannot be before start date';
        }

        return undefined;
      } catch {
        return undefined;
      }
    },
    [maxDate, startDate, endDate],
  );

  const startDateError = useMemo(() => getDateError(startDate, true), [getDateError, startDate]);
  const endDateError = useMemo(() => getDateError(endDate, false), [getDateError, endDate]);

  // Generate report
  const handleGenerateReport = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const reportData = await generateReport();
      setReportState({
        startDate,
        endDate,
        report: reportData,
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-surface rounded border border-border p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Preset Buttons */}
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d', 'all'] as const).map((preset) => (
              <Button
                key={preset}
                variant={activePreset === preset ? 'primary' : 'surface'}
                size="sm"
                onClick={() => handlePresetChange(preset)}
              >
                {preset === 'all' ? 'All Time' : preset.toUpperCase()}
              </Button>
            ))}
          </div>

          <div className="text-secondary">or</div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-2">
            <DatePicker
              value={startDate as ZonedDateTime}
              onChange={handleStartDateChange as (date: ZonedDateTime) => void}
              minValue={minDate}
              maxValue={maxDate}
              isInvalid={!!startDateError}
              errorMessage={startDateError}
              granularity="day"
            />
            <span className="text-secondary">to</span>
            <DatePicker
              value={endDate as ZonedDateTime}
              onChange={handleEndDateChange as (date: ZonedDateTime) => void}
              minValue={minDate}
              maxValue={maxDate}
              isInvalid={!!endDateError}
              errorMessage={endDateError}
              granularity="day"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={() => {
              void handleGenerateReport();
            }}
            disabled={isGenerating || !!startDateError || !!endDateError}
            className="min-w-[100px]"
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
      </div>

      {/* Report Content */}
      {reportState?.report ? (
        <ReportTable
          startDate={reportState.startDate}
          endDate={reportState.endDate}
          report={reportState.report}
          asset={selectedAsset}
          chainId={chainId}
        />
      ) : (
        <div className="bg-surface rounded border border-border p-12 text-center">
          <p className="text-secondary">Select a date range and click Generate to view your position report.</p>
          <p className="text-secondary text-sm mt-2">The report will show interest earned, transaction history, and performance metrics.</p>
        </div>
      )}
    </div>
  );
}

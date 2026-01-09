'use client';
import { useMemo } from 'react';
import { HiFire } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useMarketPreferences, type FlowTimeWindow, type TrendingWindowConfig } from '@/stores/useMarketPreferences';
import { useMarketMetricsMap, isMarketTrending, getMetricsKey } from '@/hooks/queries/useMarketMetricsQuery';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { formatReadable } from '@/utils/balance';
import type { Market } from '@/utils/types';

type TrendingSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const TIME_WINDOWS: { value: FlowTimeWindow; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

function generateFilterSummary(config: { enabled: boolean; windows: Record<FlowTimeWindow, TrendingWindowConfig> }): string {
  if (!config.enabled) return 'Trending detection is disabled';

  const parts: string[] = [];

  for (const { value: window, label } of TIME_WINDOWS) {
    const windowConfig = config.windows?.[window];
    if (!windowConfig) continue;

    const windowParts: string[] = [];

    // Supply thresholds - defensive access for old stored data
    const supplyPct = windowConfig.minSupplyFlowPct ?? '';
    const supplyUsd = windowConfig.minSupplyFlowUsd ?? '';
    const supplyParts: string[] = [];
    if (supplyPct) supplyParts.push(`+${supplyPct}%`);
    if (supplyUsd) supplyParts.push(`+$${formatReadable(Number(supplyUsd))}`);
    if (supplyParts.length > 0) {
      windowParts.push(`supply grew ${supplyParts.join(' and ')}`);
    }

    // Borrow thresholds - defensive access for old stored data
    const borrowPct = windowConfig.minBorrowFlowPct ?? '';
    const borrowUsd = windowConfig.minBorrowFlowUsd ?? '';
    const borrowParts: string[] = [];
    if (borrowPct) borrowParts.push(`+${borrowPct}%`);
    if (borrowUsd) borrowParts.push(`+$${formatReadable(Number(borrowUsd))}`);
    if (borrowParts.length > 0) {
      windowParts.push(`borrow grew ${borrowParts.join(' and ')}`);
    }

    if (windowParts.length > 0) {
      parts.push(`${windowParts.join(', ')} in ${label}`);
    }
  }

  if (parts.length === 0) return 'No thresholds configured';
  return `Markets where ${parts.join('; ')}`;
}

function CompactInput({
  value,
  onChange,
  disabled,
  prefix,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {prefix && <span className="font-inter text-[10px] text-secondary">{prefix}</span>}
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const stripped = e.target.value.replace(/[^0-9.]/g, '');
          const parts = stripped.split('.');
          const result = parts.length <= 1 ? stripped : `${parts[0]}.${parts.slice(1).join('')}`;
          onChange(result);
        }}
        placeholder="-"
        disabled={disabled}
        className="font-inter h-6 w-12 px-1 text-center text-xs"
      />
      {suffix && <span className="font-inter text-[10px] text-secondary">{suffix}</span>}
    </div>
  );
}

export default function TrendingSettingsModal({ isOpen, onOpenChange }: TrendingSettingsModalProps) {
  const { trendingConfig, setTrendingEnabled, setTrendingWindowConfig } = useMarketPreferences();
  const { metricsMap } = useMarketMetricsMap();
  const { allMarkets } = useProcessedMarkets();
  const isEnabled = trendingConfig.enabled;

  // Compute matching markets for preview
  const matchingMarkets = useMemo(() => {
    if (!isEnabled || metricsMap.size === 0) return [];

    const matches: Array<{ market: Market; supplyFlowPct1h: number }> = [];

    for (const [key, metrics] of metricsMap) {
      if (isMarketTrending(metrics, trendingConfig)) {
        const market = allMarkets.find((m) => getMetricsKey(m.morphoBlue.chain.id, m.uniqueKey) === key);
        if (market) {
          matches.push({
            market,
            supplyFlowPct1h: metrics.flows['1h']?.supplyFlowPct ?? 0,
          });
        }
      }
    }

    return matches.sort((a, b) => (b.market.state?.supplyAssetsUsd ?? 0) - (a.market.state?.supplyAssetsUsd ?? 0));
  }, [isEnabled, metricsMap, trendingConfig, allMarkets]);

  const totalMatches = matchingMarkets.length;

  const handleChange = (window: FlowTimeWindow, field: keyof TrendingWindowConfig, value: string) => {
    setTrendingWindowConfig(window, { [field]: value });
  };

  const filterSummary = generateFilterSummary(trendingConfig);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      size="lg"
      zIndex="settings"
      scrollBehavior="inside"
    >
      {(onClose) => (
        <>
          <ModalHeader
            title={
              <span className="flex items-center gap-2">
                Trending Markets
                <span className="rounded-sm bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-normal text-orange-500">Beta</span>
              </span>
            }
            mainIcon={<HiFire className="h-4 w-4 text-orange-500" />}
            onClose={onClose}
          />
          <ModalBody className="flex flex-col gap-4">
            {/* Toggle + Summary */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-secondary leading-relaxed">{filterSummary}</p>
              </div>
              <IconSwitch
                selected={isEnabled}
                onChange={setTrendingEnabled}
                size="xs"
                color="primary"
              />
            </div>

            {/* Compact threshold table */}
            <div className={`overflow-hidden rounded-lg border border-border ${isEnabled ? '' : 'opacity-50'}`}>
              {/* Header */}
              <div className="grid grid-cols-[50px_1fr_1fr] gap-2 border-b border-border bg-surface px-3 py-2">
                <div />
                <div className="text-[10px] font-medium uppercase tracking-wide text-secondary">Supply Flow</div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-secondary">Borrow Flow</div>
              </div>

              {/* Rows */}
              {TIME_WINDOWS.map(({ value: window, label }) => {
                const config = trendingConfig.windows[window];

                return (
                  <div
                    key={window}
                    className="grid grid-cols-[50px_1fr_1fr] items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <div className="text-xs font-medium text-primary">{label}</div>

                    {/* Supply inputs */}
                    <div className="flex items-center gap-1.5">
                      <CompactInput
                        value={config.minSupplyFlowPct}
                        onChange={(v) => handleChange(window, 'minSupplyFlowPct', v)}
                        disabled={!isEnabled}
                        suffix="%"
                      />
                      <CompactInput
                        value={config.minSupplyFlowUsd}
                        onChange={(v) => handleChange(window, 'minSupplyFlowUsd', v.replace(/[^0-9]/g, ''))}
                        disabled={!isEnabled}
                        prefix="$"
                      />
                    </div>

                    {/* Borrow inputs */}
                    <div className="flex items-center gap-1.5">
                      <CompactInput
                        value={config.minBorrowFlowPct}
                        onChange={(v) => handleChange(window, 'minBorrowFlowPct', v)}
                        disabled={!isEnabled}
                        suffix="%"
                      />
                      <CompactInput
                        value={config.minBorrowFlowUsd}
                        onChange={(v) => handleChange(window, 'minBorrowFlowUsd', v.replace(/[^0-9]/g, ''))}
                        disabled={!isEnabled}
                        prefix="$"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview */}
            {isEnabled && (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-secondary">Preview</span>
                  <span className="text-xs text-secondary">
                    {totalMatches > 0 ? `${totalMatches} market${totalMatches !== 1 ? 's' : ''} match` : 'No matches'}
                  </span>
                </div>
                <div className="px-3 py-2">
                  {matchingMarkets.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {matchingMarkets.slice(0, 2).map((m) => (
                        <div
                          key={m.market.uniqueKey}
                          className="flex items-center justify-between"
                        >
                          <MarketIdentity
                            market={m.market}
                            chainId={m.market.morphoBlue.chain.id}
                            mode={MarketIdentityMode.Normal}
                            showLltv={false}
                            showOracle={false}
                            iconSize={16}
                          />
                          <span className="text-xs text-green-500">+{m.supplyFlowPct1h.toFixed(1)}%</span>
                        </div>
                      ))}
                      {totalMatches > 2 && <span className="text-[10px] text-secondary">+{totalMatches - 2} more</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-secondary">No markets match current criteria</span>
                  )}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="default"
              onClick={onClose}
              size="sm"
            >
              Done
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

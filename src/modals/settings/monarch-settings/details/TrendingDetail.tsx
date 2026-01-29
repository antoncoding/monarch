'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { IconSwitch } from '@/components/ui/icon-switch';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useMarketPreferences, type FlowTimeWindow, type CustomTagWindowConfig } from '@/stores/useMarketPreferences';
import { useMarketMetricsMap, matchesCustomTag, getMetricsKey } from '@/hooks/queries/useMarketMetricsQuery';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { CustomTagIconPicker, CustomTagIcon } from '@/components/shared/custom-tag-icons';
import type { Market } from '@/utils/types';

const TIME_WINDOWS: { value: FlowTimeWindow; label: string }[] = [
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

function formatThreshold(value: string): string {
  if (!value || value === '') return '-';
  const num = Number(value);
  return num >= 0 ? `≥${value}%` : `≤${value}%`;
}

function generateFilterSummary(config: { enabled: boolean; windows: Record<FlowTimeWindow, CustomTagWindowConfig> }): string {
  if (!config.enabled) return 'Disabled';

  const parts: string[] = [];

  for (const { value: window, label } of TIME_WINDOWS) {
    const windowConfig = config.windows?.[window];
    if (!windowConfig) continue;

    const supply = windowConfig.supplyFlowPct ?? '';
    const borrow = windowConfig.borrowFlowPct ?? '';

    if (!supply && !borrow) continue;

    const conditions: string[] = [];
    if (supply) conditions.push(`Supply ${formatThreshold(supply)}`);
    if (borrow) conditions.push(`Borrow ${formatThreshold(borrow)}`);

    parts.push(`${label}: ${conditions.join(', ')}`);
  }

  if (parts.length === 0) return 'No thresholds set';
  return parts.join(' | ');
}

function PercentInput({
  value,
  onChange,
  placeholder = '0',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center">
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          // Allow negative numbers and decimals
          const v = e.target.value;
          if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) {
            onChange(v);
          }
        }}
        placeholder={placeholder}
        className="font-inter h-8 w-16 px-2 text-center text-sm"
      />
      <span className="ml-1 text-xs text-secondary">%</span>
    </div>
  );
}

export function TrendingDetail() {
  const { customTagConfig, setCustomTagEnabled, setCustomTagIcon, setCustomTagWindowConfig } = useMarketPreferences();
  const { metricsMap } = useMarketMetricsMap();
  const { allMarkets } = useProcessedMarkets();
  const isEnabled = customTagConfig.enabled;

  const matchingMarkets = useMemo(() => {
    if (!isEnabled || metricsMap.size === 0) return [];

    const matches: Array<{ market: Market; supplyFlowPct: number; window: string }> = [];

    for (const [key, metrics] of metricsMap) {
      if (matchesCustomTag(metrics, customTagConfig)) {
        const market = allMarkets.find((m) => getMetricsKey(m.morphoBlue.chain.id, m.uniqueKey) === key);
        if (market) {
          // Find which window matched for display
          const matchedWindow = TIME_WINDOWS.find(({ value }) => {
            const cfg = customTagConfig.windows[value];
            return cfg.supplyFlowPct || cfg.borrowFlowPct;
          });
          matches.push({
            market,
            supplyFlowPct: metrics.flows['24h']?.supplyFlowPct ?? 0,
            window: matchedWindow?.label ?? '24h',
          });
        }
      }
    }

    return matches.sort((a, b) => (b.market.state?.supplyAssetsUsd ?? 0) - (a.market.state?.supplyAssetsUsd ?? 0));
  }, [isEnabled, metricsMap, customTagConfig, allMarkets]);

  const totalMatches = matchingMarkets.length;

  const handleChange = (window: FlowTimeWindow, field: keyof CustomTagWindowConfig, value: string) => {
    setCustomTagWindowConfig(window, { [field]: value });
  };

  const filterSummary = generateFilterSummary(customTagConfig);

  return (
    <div className="flex flex-col gap-4">
      {/* Enable Toggle - Primary action at top */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CustomTagIcon iconId={customTagConfig.icon} size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Custom Tag</p>
            <p className="text-xs text-secondary max-w-[200px] truncate">{filterSummary}</p>
          </div>
        </div>
        <IconSwitch
          selected={isEnabled}
          onChange={setCustomTagEnabled}
          size="sm"
          color="primary"
        />
      </div>

      {/* Configuration - Only show when enabled */}
      {isEnabled && (
        <>
          {/* Icon Picker */}
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <span className="text-xs font-medium text-secondary uppercase">Icon</span>
            <CustomTagIconPicker
              selectedIcon={customTagConfig.icon}
              onSelect={setCustomTagIcon}
            />
          </div>

          {/* Threshold table - simplified */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-surface px-4 py-3">
              <span className="text-xs font-medium text-secondary uppercase">Flow Thresholds</span>
              <p className="text-[10px] text-secondary mt-1">
                Use positive values for growth (≥5%), negative for decline (≤-3%)
              </p>
            </div>

            {/* Header */}
            <div className="grid grid-cols-3 gap-4 border-b border-border px-4 py-2 bg-surface/50">
              <div className="text-xs font-medium text-secondary">Period</div>
              <div className="text-xs font-medium text-secondary text-center">Supply</div>
              <div className="text-xs font-medium text-secondary text-center">Borrow</div>
            </div>

            {/* Rows */}
            {TIME_WINDOWS.map(({ value: window, label }) => {
              const config = customTagConfig.windows[window];

              return (
                <div
                  key={window}
                  className="grid grid-cols-3 gap-4 items-center px-4 py-3 border-b border-border last:border-b-0"
                >
                  <div className="text-sm text-primary">{label}</div>
                  <div className="flex justify-center">
                    <PercentInput
                      value={config.supplyFlowPct}
                      onChange={(v) => handleChange(window, 'supplyFlowPct', v)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <PercentInput
                      value={config.borrowFlowPct}
                      onChange={(v) => handleChange(window, 'borrowFlowPct', v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
              <span className="text-xs font-medium uppercase text-secondary">Preview</span>
              <span className="text-xs text-secondary">
                {totalMatches > 0 ? `${totalMatches} match${totalMatches !== 1 ? 'es' : ''}` : 'No matches'}
              </span>
            </div>
            <div className="p-4">
              {matchingMarkets.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {matchingMarkets.slice(0, 3).map((m) => (
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
                      <span className={`text-xs ${m.supplyFlowPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {m.supplyFlowPct >= 0 ? '+' : ''}{m.supplyFlowPct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {totalMatches > 3 && (
                    <span className="text-xs text-secondary">+{totalMatches - 3} more</span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-secondary">No markets match current criteria</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

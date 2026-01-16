'use client';

import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import type { DetailView } from '../constants';

type ExperimentalPanelProps = {
  onNavigateToDetail?: (view: DetailView) => void;
};

export function ExperimentalPanel({ onNavigateToDetail }: ExperimentalPanelProps) {
  const { trendingConfig, setTrendingEnabled } = useMarketPreferences();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        {/* Trending Markets Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-primary">Trending Markets</h3>
            <p className="text-xs text-secondary">Highlight markets with significant supply or borrow activity based on flow metrics.</p>
          </div>
          <IconSwitch
            selected={trendingConfig.enabled}
            onChange={setTrendingEnabled}
            size="xs"
            color="primary"
            aria-label="Toggle trending markets"
          />
        </div>

        <div className="border-t border-border" />

        {/* Configure Button */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-primary">Configure Trending Criteria</h3>
            <p className="text-xs text-secondary">Define thresholds for market flow metrics to identify trending markets.</p>
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={() => onNavigateToDetail?.('trending-config')}
          >
            Configure
          </Button>
        </div>
      </div>
    </div>
  );
}

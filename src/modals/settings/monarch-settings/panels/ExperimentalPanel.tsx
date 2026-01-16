'use client';

import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { SettingToggleItem, SettingActionItem } from '../SettingItem';
import type { DetailView } from '../constants';

type ExperimentalPanelProps = {
  onNavigateToDetail?: (view: DetailView) => void;
};

export function ExperimentalPanel({ onNavigateToDetail }: ExperimentalPanelProps) {
  const { trendingConfig, setTrendingEnabled } = useMarketPreferences();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded bg-surface p-4">
        <SettingToggleItem
          title="Trending Markets"
          description="Highlight markets with significant supply or borrow activity based on flow metrics."
          selected={trendingConfig.enabled}
          onChange={setTrendingEnabled}
          ariaLabel="Toggle trending markets"
        />
      </div>

      <div className="rounded bg-surface p-4">
        <SettingActionItem
          title="Configure Trending Criteria"
          description="Define thresholds for market flow metrics to identify trending markets."
          buttonLabel="Configure"
          onClick={() => onNavigateToDetail?.('trending-config')}
        />
      </div>
    </div>
  );
}

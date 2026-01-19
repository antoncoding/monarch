'use client';

import { Divider } from '@/components/ui/divider';
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
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Trending</h3>
        <SettingToggleItem
          title="Enable Trending Filter"
          description="Show a 'Trending' filter option in the markets filter popover."
          selected={trendingConfig.enabled}
          onChange={setTrendingEnabled}
          ariaLabel="Toggle trending markets"
        />
        <Divider />
        <SettingActionItem
          title="Configure Criteria"
          description="Set thresholds for what makes a market 'trending'."
          buttonLabel="Configure"
          onClick={() => onNavigateToDetail?.('trending-config')}
        />
      </div>
    </div>
  );
}

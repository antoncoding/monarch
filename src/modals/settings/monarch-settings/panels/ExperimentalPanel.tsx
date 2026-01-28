'use client';

import { Divider } from '@/components/ui/divider';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { SettingToggleItem, SettingActionItem } from '../SettingItem';
import type { DetailView } from '../constants';

type ExperimentalPanelProps = {
  onNavigateToDetail?: (view: Exclude<DetailView, null>) => void;
};

export function ExperimentalPanel({ onNavigateToDetail }: ExperimentalPanelProps) {
  const { trendingConfig, setTrendingEnabled } = useMarketPreferences();
  const { showDeveloperOptions, setShowDeveloperOptions, usePublicAllocator, setUsePublicAllocator } = useAppSettings();

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

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Liquidity Sourcing</h3>
        <SettingToggleItem
          title="Source Liquidity via Public Allocator"
          description="Automatically source extra liquidity from vault reserves when market liquidity is insufficient for your withdraw or borrow."
          selected={usePublicAllocator}
          onChange={setUsePublicAllocator}
          ariaLabel="Toggle public allocator"
        />
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Developer</h3>
        <SettingToggleItem
          title="Developer Options"
          description="Show advanced developer tools like Accrue Interest in market detail views."
          selected={showDeveloperOptions}
          onChange={setShowDeveloperOptions}
          ariaLabel="Toggle developer options"
        />
      </div>
    </div>
  );
}

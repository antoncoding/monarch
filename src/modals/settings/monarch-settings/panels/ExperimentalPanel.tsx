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
  const { showOfficialTrending, setShowOfficialTrending, customTagConfig, setCustomTagEnabled } = useMarketPreferences();
  const { showDeveloperOptions, setShowDeveloperOptions, usePublicAllocator, setUsePublicAllocator } = useAppSettings();

  return (
    <div className="flex flex-col gap-4">
      {/* Official Trending */}
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Official Trending</h3>
        <SettingToggleItem
          title="Show Trending Markets"
          description="Display trending icon on officially trending markets (backend-computed based on flow activity)."
          selected={showOfficialTrending}
          onChange={setShowOfficialTrending}
          ariaLabel="Toggle official trending display"
        />
      </div>

      {/* Custom Tags */}
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Custom Tags</h3>
        <SettingToggleItem
          title="Enable Custom Tags"
          description="Create your own market tags based on flow criteria."
          selected={customTagConfig.enabled}
          onChange={setCustomTagEnabled}
          ariaLabel="Toggle custom tags"
        />
        {customTagConfig.enabled && (
          <>
            <Divider />
            <SettingActionItem
              title="Configure Custom Tag"
              description="Set thresholds and choose an icon."
              buttonLabel="Configure"
              onClick={() => onNavigateToDetail?.('custom-tag-config')}
            />
          </>
        )}
      </div>

      {/* Liquidity Sourcing */}
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

      {/* Developer */}
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Developer</h3>
        <SettingToggleItem
          title="Developer Options"
          description="Show advanced developer tools like Accrue Interest and Liquidate in market detail views."
          selected={showDeveloperOptions}
          onChange={setShowDeveloperOptions}
          ariaLabel="Toggle developer options"
        />
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Divider } from '@/components/ui/divider';
import { IconSwitch } from '@/components/ui/icon-switch';
import { PaletteSelector } from '@/components/ui/palette-preview';
import { useAppSettings } from '@/stores/useAppSettings';
import { useChartPalette } from '@/stores/useChartPalette';
import { SettingToggleItem } from '../SettingItem';

export function DisplayPanel() {
  const { isAprDisplay, setIsAprDisplay, showFullRewardAPY, setShowFullRewardAPY } = useAppSettings();
  const { palette: selectedPalette, setPalette } = useChartPalette();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = theme === 'dark';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Appearance</h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary">Dark Mode</span>
            <span className="text-xs text-secondary">Switch between light and dark color themes.</span>
          </div>
          {mounted && (
            <IconSwitch
              selected={isDarkMode}
              onChange={() => setTheme(isDarkMode ? 'light' : 'dark')}
              size="xs"
              color="primary"
              aria-label="Toggle dark mode"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Rate Display</h3>
        <SettingToggleItem
          title="Show APR Instead of APY"
          description="Display simple annualized rate instead of compounded yield."
          selected={isAprDisplay}
          onChange={setIsAprDisplay}
          ariaLabel="Toggle APR display"
        />
        <Divider />
        <SettingToggleItem
          title="Show Full Reward APY"
          description="Include external rewards like MORPHO emissions in APY values."
          selected={showFullRewardAPY}
          onChange={setShowFullRewardAPY}
          ariaLabel="Toggle full reward APY"
        />
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Charts</h3>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary">Color Palette</span>
          <span className="text-xs text-secondary">Choose a color scheme for charts and graphs.</span>
        </div>
        {mounted && (
          <PaletteSelector
            selectedPalette={selectedPalette}
            onSelect={setPalette}
          />
        )}
      </div>
    </div>
  );
}

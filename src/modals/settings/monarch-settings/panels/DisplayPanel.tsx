'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { IconSwitch } from '@/components/ui/icon-switch';
import { PaletteSelector } from '@/components/ui/palette-preview';
import { useAppSettings } from '@/stores/useAppSettings';
import { useChartPalette } from '@/stores/useChartPalette';

export function DisplayPanel() {
  const { isAprDisplay, setIsAprDisplay } = useAppSettings();
  const { palette: selectedPalette, setPalette } = useChartPalette();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = theme === 'dark';

  return (
    <div className="flex flex-col gap-4">
      {/* Dark Mode Toggle */}
      <div className="flex items-center justify-between rounded bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-primary">Dark Mode</h3>
          <p className="text-xs text-secondary">Switch between light and dark color themes for the application interface.</p>
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

      {/* APR/APY Toggle */}
      <div className="flex items-center justify-between rounded bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-primary">Show APR Instead of APY</h3>
          <p className="text-xs text-secondary">
            Display Annual Percentage Rate (APR) instead of Annual Percentage Yield (APY). APR represents the simple annualized rate, while
            APY accounts for continuous compounding.
          </p>
        </div>
        <IconSwitch
          selected={isAprDisplay}
          onChange={setIsAprDisplay}
          size="xs"
          color="primary"
          aria-label="Toggle APR display"
        />
      </div>

      {/* Color Palette */}
      <div className="flex flex-col gap-3 rounded bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-primary">Chart Color Palette</h3>
          <p className="text-xs text-secondary">Choose a color scheme for charts and graphs across the application.</p>
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

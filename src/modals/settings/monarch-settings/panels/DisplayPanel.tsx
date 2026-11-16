'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { Divider } from '@/components/ui/divider';
import { IconSwitch } from '@/components/ui/icon-switch';
import { PaletteSelector } from '@/components/ui/palette-preview';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppSettings } from '@/stores/useAppSettings';
import { useChartPalette } from '@/stores/useChartPalette';
import { getSupportedTimeZones, getTimeZoneLabel, LOCAL_TIME_ZONE } from '@/utils/timezone';
import { SettingInputItem, SettingToggleItem } from '../SettingItem';

export function DisplayPanel() {
  const {
    isAprDisplay,
    setIsAprDisplay,
    showFullRewardAPY,
    setShowFullRewardAPY,
    showFullTokenSymbols,
    setShowFullTokenSymbols,
    timeZone,
    setTimeZone,
  } = useAppSettings();
  const { palette: selectedPalette, setPalette } = useChartPalette();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = theme === 'dark';
  const supportedTimeZones = useMemo(() => getSupportedTimeZones().filter((zone) => zone !== 'UTC'), []);

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
        <Divider />
        <SettingToggleItem
          title="Show Full Token Symbols"
          description="Display complete token symbols in market tables instead of shortening them."
          selected={showFullTokenSymbols}
          onChange={setShowFullTokenSymbols}
          ariaLabel="Toggle full token symbols"
        />
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Time</h3>
        <SettingInputItem
          title="Timezone"
          description="Used for dates and times shown in tables. Local follows this device."
        >
          {mounted && (
            <Select
              value={timeZone}
              onValueChange={setTimeZone}
            >
              <SelectTrigger
                aria-label="Timezone"
                className="h-9 w-[240px] max-w-[45vw] bg-hovered"
              >
                <SelectValue>{getTimeZoneLabel(timeZone)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="z-[3600] max-h-72">
                <SelectItem value={LOCAL_TIME_ZONE}>{getTimeZoneLabel(LOCAL_TIME_ZONE)}</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectSeparator />
                {supportedTimeZones.map((zone) => (
                  <SelectItem
                    key={zone}
                    value={zone}
                  >
                    {getTimeZoneLabel(zone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </SettingInputItem>
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

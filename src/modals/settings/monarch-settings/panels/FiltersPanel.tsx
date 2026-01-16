'use client';

import { GoShield, GoShieldCheck } from 'react-icons/go';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { SettingToggleItem } from '../SettingItem';

export function FiltersPanel() {
  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useAppSettings();
  const { includeUnknownTokens, setIncludeUnknownTokens, showUnknownOracle, setShowUnknownOracle } = useMarketPreferences();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded bg-surface p-4">
        <SettingToggleItem
          title="Show Unknown Tokens"
          description="Display tokens that aren't in our recognized token list. These will appear with a question mark icon."
          selected={includeUnknownTokens}
          onChange={setIncludeUnknownTokens}
          ariaLabel="Toggle unknown tokens"
          thumbIconOn={GoShield}
          thumbIconOff={GoShieldCheck}
        />
      </div>

      <div className="rounded bg-surface p-4">
        <SettingToggleItem
          title="Show Unknown Oracles"
          description="Display markets using oracle implementations that haven't been verified yet."
          selected={showUnknownOracle}
          onChange={setShowUnknownOracle}
          ariaLabel="Toggle unknown oracles"
          thumbIconOn={GoShield}
          thumbIconOff={GoShieldCheck}
        />
      </div>

      <div className="rounded bg-surface p-4">
        <SettingToggleItem
          title="Show Unwhitelisted Markets"
          description="Display markets that haven't been verified or whitelisted by the Morpho team. When disabled (guardian mode), only verified markets are shown."
          selected={showUnwhitelistedMarkets}
          onChange={setShowUnwhitelistedMarkets}
          ariaLabel="Toggle unwhitelisted markets"
          thumbIconOn={GoShield}
          thumbIconOff={GoShieldCheck}
        />
      </div>
    </div>
  );
}

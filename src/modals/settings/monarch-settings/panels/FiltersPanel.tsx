'use client';

import { GoShield, GoShieldCheck } from 'react-icons/go';
import { IconSwitch } from '@/components/ui/icon-switch';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';

export function FiltersPanel() {
  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useAppSettings();
  const { includeUnknownTokens, setIncludeUnknownTokens, showUnknownOracle, setShowUnknownOracle } = useMarketPreferences();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5 rounded bg-surface p-4">
        {/* Unknown Tokens */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-primary">Show Unknown Tokens</h3>
            <p className="text-xs text-secondary">
              Display tokens that aren't in our recognized token list. These will appear with a question mark icon.
            </p>
          </div>
          <IconSwitch
            selected={includeUnknownTokens}
            onChange={setIncludeUnknownTokens}
            size="xs"
            color="primary"
            thumbIconOn={GoShield}
            thumbIconOff={GoShieldCheck}
            aria-label="Toggle unknown tokens"
          />
        </div>

        <div className="border-t border-border" />

        {/* Unknown Oracles */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-primary">Show Unknown Oracles</h3>
            <p className="text-xs text-secondary">Display markets using oracle implementations that haven't been verified yet.</p>
          </div>
          <IconSwitch
            selected={showUnknownOracle}
            onChange={setShowUnknownOracle}
            size="xs"
            color="primary"
            thumbIconOn={GoShield}
            thumbIconOff={GoShieldCheck}
            aria-label="Toggle unknown oracles"
          />
        </div>

        <div className="border-t border-border" />

        {/* Unwhitelisted Markets */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-primary">Show Unwhitelisted Markets</h3>
            <p className="text-xs text-secondary">
              Display markets that haven't been verified or whitelisted by the Morpho team. When disabled (guardian mode), only verified
              markets are shown.
            </p>
          </div>
          <IconSwitch
            selected={showUnwhitelistedMarkets}
            onChange={setShowUnwhitelistedMarkets}
            size="xs"
            color="primary"
            thumbIconOn={GoShield}
            thumbIconOff={GoShieldCheck}
            aria-label="Toggle unwhitelisted markets"
          />
        </div>
      </div>
    </div>
  );
}

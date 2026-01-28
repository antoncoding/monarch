'use client';

import { GoShield, GoShieldCheck } from 'react-icons/go';
import { Divider } from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { SettingToggleItem, SettingInputItem } from '../SettingItem';

export function FiltersPanel() {
  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useAppSettings();
  const {
    includeUnknownTokens,
    setIncludeUnknownTokens,
    showUnknownOracle,
    setShowUnknownOracle,
    showLockedMarkets,
    setShowLockedMarkets,
    usdMinSupply,
    setUsdMinSupply,
    usdMinBorrow,
    setUsdMinBorrow,
    usdMinLiquidity,
    setUsdMinLiquidity,
  } = useMarketPreferences();

  const handleThresholdChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (/^\d*$/.test(value)) {
      setter(value);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Risk Guards Section */}
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Risk Guards</h3>
        <SettingToggleItem
          title="Show Unknown Tokens"
          description="Display tokens that aren't in our recognized token list. These will appear with a question mark icon."
          selected={includeUnknownTokens}
          onChange={setIncludeUnknownTokens}
          ariaLabel="Toggle unknown tokens"
          thumbIconOn={GoShield}
          thumbIconOff={GoShieldCheck}
        />
        <Divider />
        <SettingToggleItem
          title="Show Unknown Oracles"
          description="Display markets using oracle implementations that haven't been verified yet."
          selected={showUnknownOracle}
          onChange={setShowUnknownOracle}
          ariaLabel="Toggle unknown oracles"
          thumbIconOn={GoShield}
          thumbIconOff={GoShieldCheck}
        />
        <Divider />
        <SettingToggleItem
          title="Show Unwhitelisted Markets"
          description="Display markets that haven't been verified or whitelisted by the Morpho team."
          selected={showUnwhitelistedMarkets}
          onChange={setShowUnwhitelistedMarkets}
          ariaLabel="Toggle unwhitelisted markets"
          thumbIconOn={GoShield}
          thumbIconOff={GoShieldCheck}
        />
        <Divider />
        <SettingToggleItem
          title="Show Locked Markets"
          description="Display frozen markets with extreme APY (> 1500%). These are typically dead markets with inflated rates."
          selected={showLockedMarkets}
          onChange={setShowLockedMarkets}
          ariaLabel="Toggle locked markets"
          thumbIconOn={GoShield}
          thumbIconOff={GoShieldCheck}
        />
      </div>

      {/* Default Thresholds Section */}
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Default Thresholds</h3>
        <p className="-mt-2 text-xs text-secondary">
          Set minimum values for market filters. Enable or disable these filters from the Filters button on the markets page.
        </p>
        <SettingInputItem
          title="Min Supply (USD)"
          description="Only show markets where supplied assets meet this threshold."
        >
          <Input
            aria-label="Minimum supply value"
            placeholder="0"
            value={usdMinSupply}
            onChange={handleThresholdChange(setUsdMinSupply)}
            size="sm"
            type="text"
            pattern="[0-9]*"
            inputMode="numeric"
            className="w-28"
            classNames={{ input: 'text-right' }}
            startContent={<span className="text-small text-primary">$</span>}
          />
        </SettingInputItem>
        <Divider />
        <SettingInputItem
          title="Min Borrow (USD)"
          description="Only show markets where borrowed assets meet this threshold."
        >
          <Input
            aria-label="Minimum borrow value"
            placeholder="0"
            value={usdMinBorrow}
            onChange={handleThresholdChange(setUsdMinBorrow)}
            size="sm"
            type="text"
            pattern="[0-9]*"
            inputMode="numeric"
            className="w-28"
            classNames={{ input: 'text-right' }}
            startContent={<span className="text-small text-primary">$</span>}
          />
        </SettingInputItem>
        <Divider />
        <SettingInputItem
          title="Min Liquidity (USD)"
          description="Only show markets where available liquidity meets this threshold."
        >
          <Input
            aria-label="Minimum liquidity value"
            placeholder="0"
            value={usdMinLiquidity}
            onChange={handleThresholdChange(setUsdMinLiquidity)}
            size="sm"
            type="text"
            pattern="[0-9]*"
            inputMode="numeric"
            className="w-28"
            classNames={{ input: 'text-right' }}
            startContent={<span className="text-small text-primary">$</span>}
          />
        </SettingInputItem>
      </div>
    </div>
  );
}

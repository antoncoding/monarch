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
        <p className="-mt-2 text-xs text-secondary">Enable guards to filter out unverified or risky markets.</p>
        <SettingToggleItem
          title="Hide Unknown Tokens"
          description="Filter out tokens that aren't in our recognized token list. These would appear with a question mark icon."
          selected={!includeUnknownTokens}
          onChange={(checked) => setIncludeUnknownTokens(!checked)}
          ariaLabel="Toggle hide unknown tokens"
          color="success"
          thumbIconOn={GoShieldCheck}
          thumbIconOff={GoShield}
        />
        <Divider />
        <SettingToggleItem
          title="Hide Unknown Oracles"
          description="Filter out markets using oracle implementations that haven't been verified yet."
          selected={!showUnknownOracle}
          onChange={(checked) => setShowUnknownOracle(!checked)}
          ariaLabel="Toggle hide unknown oracles"
          color="success"
          thumbIconOn={GoShieldCheck}
          thumbIconOff={GoShield}
        />
        <Divider />
        <SettingToggleItem
          title="Hide Unwhitelisted Markets"
          description="Filter out markets that haven't been verified or whitelisted by the Morpho team."
          selected={!showUnwhitelistedMarkets}
          onChange={(checked) => setShowUnwhitelistedMarkets(!checked)}
          ariaLabel="Toggle hide unwhitelisted markets"
          color="success"
          thumbIconOn={GoShieldCheck}
          thumbIconOff={GoShield}
        />
        <Divider />
        <SettingToggleItem
          title="Hide Locked Markets"
          description="Filter out frozen markets with extreme APY (> 1500%). These are typically dead markets with inflated rates."
          selected={!showLockedMarkets}
          onChange={(checked) => setShowLockedMarkets(!checked)}
          ariaLabel="Toggle hide locked markets"
          color="success"
          thumbIconOn={GoShieldCheck}
          thumbIconOff={GoShield}
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

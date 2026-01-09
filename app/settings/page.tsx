'use client';

import React from 'react';
import { GoShield, GoShieldCheck } from 'react-icons/go';
import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import Header from '@/components/layout/header/Header';
import { AdvancedRpcSettings } from '@/modals/settings/custom-rpc-settings';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { defaultTrustedVaults } from '@/constants/vaults/known_vaults';
import { useModal } from '@/hooks/useModal';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';

export default function SettingsPage() {
  const { usePermit2, setUsePermit2, showUnwhitelistedMarkets, setShowUnwhitelistedMarkets, isAprDisplay, setIsAprDisplay } =
    useAppSettings();
  const { includeUnknownTokens, setIncludeUnknownTokens, showUnknownOracle, setShowUnknownOracle } = useMarketPreferences();

  const { vaults: userTrustedVaults } = useTrustedVaults();

  const { open: openModal } = useModal();
  const [mounted, setMounted] = React.useState(false);

  const defaultVaultKeys = React.useMemo(() => {
    return new Set(defaultTrustedVaults.map((vault) => `${vault.chainId}-${vault.address.toLowerCase()}`));
  }, []);

  const sortedTrustedVaults = React.useMemo(() => {
    return [...userTrustedVaults].sort((a, b) => {
      const aDefault = defaultVaultKeys.has(`${a.chainId}-${a.address.toLowerCase()}`);
      const bDefault = defaultVaultKeys.has(`${b.chainId}-${b.address.toLowerCase()}`);
      if (aDefault === bDefault) return 0;
      return aDefault ? -1 : 1;
    });
  }, [userTrustedVaults, defaultVaultKeys]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 pb-12">
        <h1 className="py-8 font-zen">Settings</h1>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="text font-monospace text-secondary">Transaction Settings</h2>

            <div className="bg-surface rounded p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Use Gasless Approvals</h3>
                  <p className="text-sm text-secondary">
                    Enable signature-based token approvals using Permit2. This bundles approvals and actions into a single transaction,
                    saving gas.
                  </p>
                  <p className="mt-2 text-xs text-secondary opacity-80">
                    Note: If you're using a smart contract wallet (like Safe or other multisig), you may want to disable this and use
                    standard approvals instead.
                  </p>
                </div>
                <IconSwitch
                  selected={usePermit2}
                  onChange={setUsePermit2}
                  size="xs"
                  color="primary"
                  aria-label="Toggle gasless approvals"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <h2 className="text font-monospace text-secondary">Display Settings</h2>

            <div className="bg-surface rounded p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Show APR Instead of APY</h3>
                  <p className="text-sm text-secondary">
                    Display Annual Percentage Rate (APR) instead of Annual Percentage Yield (APY). APR represents the simple annualized
                    rate, while APY accounts for continuous compounding.
                  </p>
                  <p className="mt-2 text-xs text-secondary opacity-80">
                    APR is calculated as ln(1 + APY) and represents the underlying per-second rate annualized without compounding effects.
                    This affects all rate displays including tables, charts, and statistics.
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
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <h2 className="text font-monospace text-secondary">Filter Settings</h2>

            <div className="bg-surface flex flex-col gap-6 rounded p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Show Unknown Tokens</h3>
                  <p className="text-sm text-secondary">
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

              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Show Unknown Oracles</h3>
                  <p className="text-sm text-secondary">Display markets using oracle implementations that haven't been verified yet.</p>
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

              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Show Unwhitelisted Markets</h3>
                  <p className="text-sm text-secondary">
                    Display markets that haven't been verified or whitelisted by the Morpho team. When disabled (guardian mode), only
                    verified markets are shown.
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

          <div className="flex flex-col gap-4 pt-4">
            <div className="flex items-center gap-2">
              <h2 className="text font-monospace text-secondary">Trending Markets</h2>
              <span className="rounded-sm bg-orange-500/20 px-2 py-0.5 text-xs text-orange-500">Beta</span>
            </div>

            <div className="bg-surface rounded p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Configure Trending Criteria</h3>
                  <p className="text-sm text-secondary">
                    Define thresholds for market flow metrics to identify trending markets. Markets meeting all criteria will show a fire
                    indicator.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => openModal('trendingSettings', {})}
                >
                  Configure
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <h2 className="text font-monospace text-secondary">Trusted Vaults</h2>

            <div className="bg-surface flex flex-col gap-4 rounded p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Manage Trusted Vaults</h3>
                  <p className="text-sm text-secondary">
                    Choose which vaults you trust. Only vaults marked as default trusted are selected automatically, and you can adjust the
                    list any time.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => openModal('trustedVaults', {})}
                >
                  Edit
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {mounted ? (
                    <>
                      {sortedTrustedVaults.slice(0, 12).map((vault) => (
                        <VaultIdentity
                          key={`${vault.address}-${vault.chainId}`}
                          address={vault.address as `0x${string}`}
                          chainId={vault.chainId}
                          curator={vault.curator}
                          vaultName={vault.name}
                          asset={vault.asset}
                          variant="icon"
                          iconSize={24}
                          showTooltip
                          showLink
                        />
                      ))}
                      {userTrustedVaults.length > 12 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs text-secondary dark:bg-gray-700">
                          +{userTrustedVaults.length - 12}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-8 items-center text-sm text-secondary">Loading vaults...</div>
                  )}
                </div>
                <span className="text-xs text-secondary">
                  {userTrustedVaults.length} vault
                  {userTrustedVaults.length !== 1 ? 's' : ''} trusted
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <h2 className="text font-monospace text-secondary">Blacklisted Markets</h2>

            <div className="bg-surface rounded p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Manage Blacklisted Markets</h3>
                  <p className="text-sm text-secondary">
                    Block specific markets from appearing in your view. Blacklisted markets are completely hidden from all lists.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => openModal('blacklistedMarkets', {})}
                >
                  Edit
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <AdvancedRpcSettings />
          </div>
        </div>
      </div>
    </div>
  );
}

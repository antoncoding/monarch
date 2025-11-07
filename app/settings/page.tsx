'use client';

import React from 'react';
import { Button } from '@/components/common';
import { IconSwitch } from '@/components/common/IconSwitch';
import Header from '@/components/layout/header/Header';
import { AdvancedRpcSettings } from '@/components/settings/CustomRpcSettings';
import TrustedVaultsModal from '@/components/settings/TrustedVaultsModal';
import { VaultIcon } from '@/components/vaults/VaultIcon';
import { trusted_vaults, type TrustedVault } from '@/constants/vaults/trusted_vaults';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarkets } from '@/hooks/useMarkets';

export default function SettingsPage() {
  const [usePermit2, setUsePermit2] = useLocalStorage('usePermit2', true);
  const [includeUnknownTokens, setIncludeUnknownTokens] = useLocalStorage(
    'includeUnknownTokens',
    false,
  );
  const [showUnknownOracle, setShowUnknownOracle] = useLocalStorage('showUnknownOracle', false);
  const [userTrustedVaults, setUserTrustedVaults] = useLocalStorage<TrustedVault[]>(
    'userTrustedVaults',
    trusted_vaults
  );

  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useMarkets();

  const [isTrustedVaultsModalOpen, setIsTrustedVaultsModalOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[4%]">
        <h1 className="py-8 font-zen">Settings</h1>

        <div className="flex flex-col gap-6">
          {/* Transaction Settings Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text font-monospace text-secondary">Transaction Settings</h2>

            <div className="bg-surface rounded p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Use Gasless Approvals</h3>
                  <p className="text-sm text-secondary">
                    Enable signature-based token approvals using Permit2. This bundles approvals and
                    actions into a single transaction, saving gas.
                  </p>
                  <p className="mt-2 text-xs text-secondary opacity-80">
                    Note: If you're using a smart contract wallet (like Safe or other multisig), you
                    may want to disable this and use standard approvals instead.
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

          {/* Filter Settings Section */}
          <div className="flex flex-col gap-4 pt-4">
            <h2 className="text font-monospace text-secondary">Filter Settings</h2>

            <div className="bg-surface flex flex-col gap-6 rounded p-6">
              {/* Group related settings with a subtle separator */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Show Unknown Tokens</h3>
                  <p className="text-sm text-secondary">
                    Display tokens that aren't in our recognized token list. These will appear with
                    a question mark icon.
                  </p>
                  <p className="mt-2 text-xs text-secondary opacity-80">
                    Warning: Unknown tokens should be approached with caution as they haven't been
                    verified.
                  </p>
                </div>
                <IconSwitch
                  selected={includeUnknownTokens}
                  onChange={setIncludeUnknownTokens}
                  size="xs"
                  color="primary"
                  aria-label="Toggle unknown tokens"
                />
              </div>

              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Show Unknown Oracles</h3>
                  <p className="text-sm text-secondary">
                    Display markets using oracle implementations that haven't been verified yet.
                  </p>
                  <p className="mt-2 text-xs text-secondary opacity-80">
                    Warning: Markets with unknown oracles may have additional risks.
                  </p>
                </div>
                <IconSwitch
                  selected={showUnknownOracle}
                  onChange={setShowUnknownOracle}
                  size="xs"
                  color="primary"
                  aria-label="Toggle unknown oracles"
                />
              </div>
            </div>
          </div>

          {/* Trusted Vaults Section */}
          <div className="flex flex-col gap-4 pt-4">
            <h2 className="text font-monospace text-secondary">Trusted Vaults</h2>

            <div className="bg-surface flex flex-col gap-4 rounded p-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium text-primary">Manage Trusted Vaults</h3>
                <p className="text-sm text-secondary">
                  Choose which vaults you trust. You can filter markets based on whether your trusted
                  vaults have deposited into them.
                </p>
              </div>

              {/* Display trusted vault icons */}
              <div className="flex flex-col gap-2">
                <div className="text-xs text-secondary">
                  Mounted: {mounted ? 'Yes' : 'No'} | Vaults: {userTrustedVaults.length} |
                  First curator: {userTrustedVaults[0]?.curator || 'none'}
                </div>
                <div className="flex flex-wrap gap-2">
                {mounted ? (
                  <>
                    {userTrustedVaults.slice(0, 12).map((vault) => (
                      <VaultIcon
                        key={`${vault.address}-${vault.chainId}`}
                        curator={vault.curator}
                        address={vault.address as `0x${string}`}
                        chainId={vault.chainId}
                        vaultName={vault.name}
                        width={24}
                        height={24}
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
                  <div className="flex h-8 items-center text-sm text-secondary">
                    Loading vaults...
                  </div>
                )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => setIsTrustedVaultsModalOpen(true)}
                >
                  Edit Trusted Vaults
                </Button>
                <span className="text-xs text-secondary">
                  {userTrustedVaults.length} vault{userTrustedVaults.length !== 1 ? 's' : ''} trusted
                </span>
              </div>
            </div>
          </div>

          {/* Advanced Section */}
          <div className="flex flex-col gap-4 pt-4">
            <AdvancedRpcSettings />
          </div>

          {/* Danger Zone Section */}
          <div className="flex flex-col gap-4 py-8">
            <h2 className="text font-monospace text-secondary">Danger Zone</h2>

            <div className="flex flex-col gap-6 rounded border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-red-600 dark:text-red-400">
                    Show Unwhitelisted Markets
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Display markets that haven't been verified or whitelisted by the Morpho team.
                    These markets may have additional risks including unverified oracles, tokens, or
                    other security concerns.
                  </p>
                </div>
                <IconSwitch
                  selected={showUnwhitelistedMarkets}
                  onChange={setShowUnwhitelistedMarkets}
                  size="xs"
                  color="destructive"
                  aria-label="Toggle unwhitelisted markets"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trusted Vaults Modal */}
      <TrustedVaultsModal
        isOpen={isTrustedVaultsModalOpen}
        onOpenChange={() => setIsTrustedVaultsModalOpen(!isTrustedVaultsModalOpen)}
        userTrustedVaults={userTrustedVaults}
        setUserTrustedVaults={setUserTrustedVaults}
      />
    </div>
  );
}

'use client';

import { Switch } from '@nextui-org/react';
import Header from '@/components/layout/header/Header';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarkets } from '@/hooks/useMarkets';

export default function SettingsPage() {
  const [usePermit2, setUsePermit2] = useLocalStorage('usePermit2', true);
  const [includeUnknownTokens, setIncludeUnknownTokens] = useLocalStorage(
    'includeUnknownTokens',
    false,
  );
  const [showUnknownOracle, setShowUnknownOracle] = useLocalStorage('showUnknownOracle', false);

  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useMarkets();

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[5%]">
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
                <Switch
                  defaultSelected={usePermit2}
                  onValueChange={setUsePermit2}
                  size="sm"
                  color="primary"
                  className="min-w-[64px]"
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
                <Switch
                  defaultSelected={includeUnknownTokens}
                  onValueChange={setIncludeUnknownTokens}
                  size="sm"
                  color="primary"
                  className="min-w-[64px]"
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
                <Switch
                  defaultSelected={showUnknownOracle}
                  onValueChange={setShowUnknownOracle}
                  size="sm"
                  color="primary"
                  className="min-w-[64px]"
                />
              </div>
            </div>
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
                <Switch
                  defaultSelected={showUnwhitelistedMarkets}
                  onValueChange={setShowUnwhitelistedMarkets}
                  size="sm"
                  color="danger"
                  className="min-w-[64px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

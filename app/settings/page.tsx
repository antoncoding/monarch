'use client';

import { useCallback } from 'react';
import { Switch } from '@nextui-org/react';
import Header from '@/components/layout/header/Header';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export default function SettingsPage() {
  const [usePermit2, setUsePermit2] = useLocalStorage('usePermit2', true);

  const handlePermit2Toggle = useCallback(
    (checked: boolean) => {
      setUsePermit2(checked);
    },
    [setUsePermit2],
  );

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8" style={{ padding: '0 5%' }}>
        <h1 className="py-8 font-zen">Settings</h1>
        
        <div className="flex flex-col gap-6">
          {/* Transaction Settings Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-primary">Transaction Settings</h2>
            
            <div className="bg-surface rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium text-primary">Use Gasless Approvals</h3>
                  <p className="text-secondary text-sm">
                    Enable signature-based token approvals using Permit2. This bundles approvals and actions into a single transaction, saving gas.
                  </p>
                  <p className="mt-2 text-xs text-secondary opacity-80">
                    Note: If you're using a smart contract wallet (like Safe or other multisig), you may want to disable this and use standard approvals instead.
                  </p>
                </div>
                <Switch
                  defaultSelected={usePermit2}
                  onValueChange={handlePermit2Toggle}
                  size="sm"
                  color="primary"
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

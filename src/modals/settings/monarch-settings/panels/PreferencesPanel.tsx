'use client';

import { useState, useEffect, useMemo } from 'react';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { defaultTrustedVaults } from '@/constants/vaults/known_vaults';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { SettingActionItem } from '../SettingItem';
import type { DetailView } from '../constants';

type PreferencesPanelProps = {
  onNavigateToDetail?: (view: Exclude<DetailView, null>) => void;
};

export function PreferencesPanel({ onNavigateToDetail }: PreferencesPanelProps) {
  const { vaults: userTrustedVaults } = useTrustedVaults();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultVaultKeys = useMemo(
    () => new Set(defaultTrustedVaults.map((vault) => `${vault.chainId}-${vault.address.toLowerCase()}`)),
    [],
  );

  const sortedTrustedVaults = useMemo(() => {
    return [...userTrustedVaults].sort((a, b) => {
      const aDefault = defaultVaultKeys.has(`${a.chainId}-${a.address.toLowerCase()}`);
      const bDefault = defaultVaultKeys.has(`${b.chainId}-${b.address.toLowerCase()}`);
      if (aDefault === bDefault) return 0;
      return aDefault ? -1 : 1;
    });
  }, [userTrustedVaults, defaultVaultKeys]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Trusted Vaults</h3>
        <SettingActionItem
          title="Manage Trusted Vaults"
          description="Choose which vaults you trust. Only vaults marked as default trusted are selected automatically."
          buttonLabel="Edit"
          onClick={() => onNavigateToDetail?.('trusted-vaults')}
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {mounted ? (
              <>
                {sortedTrustedVaults.slice(0, 10).map((vault) => (
                  <VaultIdentity
                    key={`${vault.address}-${vault.chainId}`}
                    address={vault.address as `0x${string}`}
                    chainId={vault.chainId}
                    curator={vault.curator}
                    vaultName={vault.name}
                    asset={vault.asset}
                    variant="icon"
                    iconSize={20}
                    showTooltip
                    showLink
                  />
                ))}
                {userTrustedVaults.length > 10 && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] text-secondary dark:bg-gray-700">
                    +{userTrustedVaults.length - 10}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-6 items-center text-xs text-secondary">Loading vaults...</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Hidden Markets</h3>
        <SettingActionItem
          title="Manage Blacklisted Markets"
          description="Block specific markets from appearing in your view. Blacklisted markets are completely hidden from all lists."
          buttonLabel="Edit"
          onClick={() => onNavigateToDetail?.('blacklisted-markets')}
        />
      </div>
    </div>
  );
}

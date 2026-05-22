'use client';

import { useState, useEffect, useMemo } from 'react';
import { RiSparkling2Fill } from 'react-icons/ri';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { useTrustedVaultMetadata } from '@/hooks/useTrustedVaultMetadata';
import { useAppSettings } from '@/stores/useAppSettings';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { isTrustedVaultV2 } from '@/utils/vaults';
import { SettingActionItem, SettingToggleItem } from '../SettingItem';
import type { DetailView } from '../constants';

type PreferencesPanelProps = {
  onNavigateToDetail?: (view: Exclude<DetailView, null>) => void;
};

export function PreferencesPanel({ onNavigateToDetail }: PreferencesPanelProps) {
  const { vaults: userTrustedVaults } = useTrustedVaults();
  const { rebalanceDefaultMode, setRebalanceDefaultMode } = useAppSettings();
  const [mounted, setMounted] = useState(false);
  const trustedVaultCount = userTrustedVaults.length;
  const { trustedVaultMap } = useTrustedVaultMetadata({
    enabled: trustedVaultCount > 0,
    trustedVaults: userTrustedVaults,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const sortedTrustedVaults = useMemo(() => {
    return Array.from(trustedVaultMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [trustedVaultMap]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Rebalance</h3>
        <SettingToggleItem
          title="Default to Smart Rebalance"
          description="When enabled, rebalance opens in smart mode. Turn off to default to manual mode."
          selected={rebalanceDefaultMode === 'smart'}
          onChange={(enabled) => setRebalanceDefaultMode(enabled ? 'smart' : 'manual')}
          ariaLabel="Toggle smart rebalance as default mode"
          thumbIconOn={RiSparkling2Fill}
        />
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Trusted Vaults</h3>
        <SettingActionItem
          title="Manage Trusted Vaults"
          description={
            trustedVaultCount === 0
              ? 'Used by Trusted By columns.'
              : `${trustedVaultCount} selected for market columns.`
          }
          buttonLabel={trustedVaultCount === 0 ? 'Set up' : 'Edit'}
          onClick={() => onNavigateToDetail?.('trusted-vaults')}
          badge={
            trustedVaultCount === 0 ? (
              <span className="rounded-sm bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">0 selected</span>
            ) : undefined
          }
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {mounted ? (
              trustedVaultCount === 0 ? (
                <div className="text-xs text-secondary">No trusted vaults selected.</div>
              ) : (
                <>
                  {sortedTrustedVaults.slice(0, 10).map((vault) => (
                    <VaultIdentity
                      key={`${vault.address}-${vault.chainId}`}
                      address={vault.address as `0x${string}`}
                      chainId={vault.chainId}
                      description={vault.metadataDescription}
                      imageSrc={vault.metadataImage}
                      vaultName={vault.name}
                      asset={vault.asset}
                      variant="icon"
                      iconSize={20}
                      showTooltip
                      showLink={isTrustedVaultV2(vault)}
                    />
                  ))}
                  {trustedVaultCount > 10 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] text-secondary dark:bg-gray-700">
                      +{trustedVaultCount - 10}
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="flex h-6 items-center text-xs text-secondary">Loading vaults</div>
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

'use client';

import type { Address } from 'viem';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { SettingsHeader } from '@/components/common/settings-modal';
import { useVaultQueryRefresh } from '@/hooks/useVaultQueryRefresh';
import { VAULT_DETAIL_TITLES } from './constants';
import type { VaultDetailView } from '@/stores/vault-settings-modal-store';
import type { SupportedNetworks } from '@/utils/networks';

type VaultSettingsHeaderProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  detailView: VaultDetailView;
  onBack: () => void;
  onClose: () => void;
};

export function VaultSettingsHeader({ vaultAddress, chainId, detailView, onBack, onClose }: VaultSettingsHeaderProps) {
  const title = detailView ? VAULT_DETAIL_TITLES[detailView] : 'Vault Settings';
  const { refetch, isRefetching } = useVaultQueryRefresh({ vaultAddress, chainId });

  return (
    <SettingsHeader
      actions={
        <button
          type="button"
          onClick={() => void refetch({ includeRetries: true })}
          disabled={isRefetching}
          className="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh vault settings"
        >
          <RefetchIcon isLoading={isRefetching} />
        </button>
      }
      title={title}
      showBack={!!detailView}
      onBack={onBack}
      onClose={onClose}
    />
  );
}

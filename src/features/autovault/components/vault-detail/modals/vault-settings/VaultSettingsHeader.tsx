'use client';

import { SettingsHeader } from '@/components/common/settings-modal';
import { VAULT_DETAIL_TITLES } from './constants';
import type { VaultDetailView } from '@/stores/vault-settings-modal-store';

type VaultSettingsHeaderProps = {
  detailView: VaultDetailView;
  onBack: () => void;
  onClose: () => void;
};

export function VaultSettingsHeader({ detailView, onBack, onClose }: VaultSettingsHeaderProps) {
  const title = detailView ? VAULT_DETAIL_TITLES[detailView] : 'Vault Settings';

  return (
    <SettingsHeader
      title={title}
      showBack={!!detailView}
      onBack={onBack}
      onClose={onClose}
    />
  );
}

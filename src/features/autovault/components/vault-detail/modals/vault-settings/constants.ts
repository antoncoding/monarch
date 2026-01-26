import type { IconType } from 'react-icons';
import { FiSettings, FiUsers } from 'react-icons/fi';
import { MdFilterList } from 'react-icons/md';
import type { VaultSettingsCategory, VaultDetailView } from '@/stores/vault-settings-modal-store';

export type CategoryConfig = {
  id: VaultSettingsCategory;
  label: string;
  icon: IconType;
};

export const VAULT_SETTINGS_CATEGORIES: CategoryConfig[] = [
  { id: 'general', label: 'GENERAL', icon: FiSettings },
  { id: 'roles', label: 'ROLES', icon: FiUsers },
  { id: 'caps', label: 'CAPS', icon: MdFilterList },
];

export const VAULT_DETAIL_TITLES: Record<Exclude<VaultDetailView, null>, string> = {
  'edit-caps': 'Edit Caps',
  'edit-allocators': 'Edit Allocators',
  'edit-metadata': 'Edit Metadata',
};

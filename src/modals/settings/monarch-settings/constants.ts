import type { IconType } from 'react-icons';
import { FiZap, FiEye, FiSliders } from 'react-icons/fi';
import { MdFilterList } from 'react-icons/md';
import { RiCodeLine, RiFlaskLine } from 'react-icons/ri';

export type SettingsCategory = 'transaction' | 'display' | 'filters' | 'preferences' | 'developer' | 'experimental';

export type DetailView =
  | 'custom-tag-config'
  | 'trusted-vaults'
  | 'blacklisted-markets'
  | 'blacklisted-assets'
  | 'rpc-config'
  | 'filter-thresholds'
  | null;

export type CategoryConfig = {
  id: SettingsCategory;
  label: string;
  icon: IconType;
  badge?: string;
};

export const SETTINGS_CATEGORIES: CategoryConfig[] = [
  { id: 'transaction', label: 'TRANSACTION', icon: FiZap },
  { id: 'display', label: 'DISPLAY', icon: FiEye },
  { id: 'filters', label: 'FILTERS', icon: MdFilterList },
  { id: 'preferences', label: 'PREFERENCES', icon: FiSliders },
  { id: 'developer', label: 'DEVELOPER', icon: RiCodeLine },
  { id: 'experimental', label: 'EXPERIMENTAL', icon: RiFlaskLine, badge: 'Beta' },
];

export const DETAIL_TITLES: Record<Exclude<DetailView, null>, string> = {
  'custom-tag-config': 'Configure Custom Tag',
  'trusted-vaults': 'Trusted Vaults',
  'blacklisted-markets': 'Blacklisted Markets',
  'blacklisted-assets': 'Blacklisted Assets',
  'rpc-config': 'Custom RPC',
  'filter-thresholds': 'Filter Thresholds',
};

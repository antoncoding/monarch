import type { IconType } from 'react-icons';
import { FiZap, FiEye } from 'react-icons/fi';
import { GoShieldCheck } from 'react-icons/go';
import { MdBlockFlipped, MdFilterList } from 'react-icons/md';
import { RiFlaskLine } from 'react-icons/ri';

export type SettingsCategory = 'transaction' | 'display' | 'filters' | 'vaults' | 'markets' | 'experimental';

export type DetailView = 'trending-config' | 'trusted-vaults' | 'blacklisted-markets' | 'rpc-config' | null;

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
  { id: 'vaults', label: 'VAULTS', icon: GoShieldCheck },
  { id: 'markets', label: 'MARKETS', icon: MdBlockFlipped },
  { id: 'experimental', label: 'EXPERIMENTAL', icon: RiFlaskLine, badge: 'Beta' },
];

export const DETAIL_TITLES: Record<Exclude<DetailView, null>, string> = {
  'trending-config': 'Configure Trending',
  'trusted-vaults': 'Trusted Vaults',
  'blacklisted-markets': 'Blacklisted Markets',
  'rpc-config': 'Custom RPC',
};

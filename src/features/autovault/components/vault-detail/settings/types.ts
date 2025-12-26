import type { Address } from 'viem';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

export type SettingsTab = 'general' | 'agents' | 'caps';

export type MarketCapState = {
  market: Market;
  relativeCap: string;
  isSelected: boolean;
};

export type GeneralTabProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
};

export type AgentsTabProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
};

export type CapsTabProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
};

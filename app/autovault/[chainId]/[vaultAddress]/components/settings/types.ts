import type { Address } from 'viem';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import type { CapData } from '@/hooks/useVaultV2Data';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

export type SettingsTab = 'general' | 'agents' | 'caps';

export type MarketCapState = {
  market: Market;
  relativeCap: string;
  isSelected: boolean;
};

export type GeneralTabProps = {
  isOwner: boolean;
  defaultName: string;
  defaultSymbol: string;
  currentName: string;
  currentSymbol: string;
  onUpdateMetadata: (values: { name?: string; symbol?: string }) => Promise<boolean>;
  updatingMetadata: boolean;
  chainId: SupportedNetworks;
};

export type AgentsTabProps = {
  isOwner: boolean;
  owner?: string;
  curator?: string;
  allocators: string[];
  sentinels?: string[];
  onSetAllocator: (allocator: Address, isAllocator: boolean) => Promise<boolean>;
  isUpdatingAllocator: boolean;
  chainId: SupportedNetworks;
};

export type CapsTabProps = {
  isOwner: boolean;
  chainId: SupportedNetworks;
  vaultAsset?: Address;
  adapterAddress?: Address;
  existingCaps?: CapData;
  updateCaps: (caps: VaultV2Cap[]) => Promise<boolean>;
  isUpdatingCaps: boolean;
};

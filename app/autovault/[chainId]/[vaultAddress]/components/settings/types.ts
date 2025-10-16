import { Address } from 'viem';
import { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { SupportedNetworks } from '@/utils/networks';
import { Market } from '@/utils/types';

export type SettingsTab = 'general' | 'agents' | 'allocations';

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

export type AllocationsTabProps = {
  isOwner: boolean;
  chainId: SupportedNetworks;
  vaultAsset?: Address;
  adapterAddress?: Address;
  existingCaps: VaultV2Cap[];
  onUpdateCaps: (caps: VaultV2Cap[]) => Promise<boolean>;
  isUpdatingCaps: boolean;
};

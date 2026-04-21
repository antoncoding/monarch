import { publicAllocatorVaultsQuery } from '@/graphql/public-allocator-query';
import { PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID } from '@/constants/public-allocator-addresses';
import type { SupportedNetworks } from '@/utils/networks';
import { morphoGraphqlFetcher } from './fetchers';
import type { VaultAllocationMarket, VaultAllocation } from './vault-allocations';

// ── Types ──

export type PublicAllocatorFlowCap = {
  maxIn: string;
  maxOut: string;
  market: {
    uniqueKey: string;
  };
};

export type PublicAllocatorConfig = {
  fee: string;
  admin: string;
  flowCaps: PublicAllocatorFlowCap[];
};

type VaultAllocator = {
  address: string;
};

export type PublicAllocatorVault = {
  address: string;
  name: string;
  symbol: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  publicAllocatorConfig: PublicAllocatorConfig;
  allocators: VaultAllocator[];
  state: {
    totalAssets: string;
    allocation: VaultAllocation[];
  };
};

// Raw API response type (publicAllocatorConfig may be null)
type RawVaultItem = {
  address: string;
  name: string;
  symbol: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  publicAllocatorConfig: PublicAllocatorConfig | null;
  allocators: VaultAllocator[];
  state: {
    totalAssets: string;
    allocation: {
      market: VaultAllocationMarket;
      supplyAssets: string;
      supplyCap: string;
    }[];
  };
};

type PublicAllocatorVaultsApiResponse = {
  data?: {
    vaults?: {
      items: RawVaultItem[];
    };
  };
  errors?: { message: string }[];
};

/**
 * Batch-fetches supplying vaults with their public allocator configuration.
 * Only returns vaults that have publicAllocatorConfig enabled and have the
 * chain's Public Allocator authorized as a current vault allocator.
 */
export const fetchPublicAllocatorVaults = async (addresses: string[], chainId: SupportedNetworks): Promise<PublicAllocatorVault[]> => {
  if (addresses.length === 0) return [];

  const response = await morphoGraphqlFetcher<PublicAllocatorVaultsApiResponse>(publicAllocatorVaultsQuery, {
    addresses,
    chainId: [chainId],
  });

  if (response?.errors?.length) {
    console.warn('fetchPublicAllocatorVaults errors:', response.errors);
  }

  const items = response?.data?.vaults?.items;
  if (!items) return [];

  const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[chainId]?.toLowerCase();
  if (!allocatorAddress) return [];

  return items.filter(
    (vault): vault is PublicAllocatorVault =>
      vault.publicAllocatorConfig !== null && vault.allocators.some((allocator) => allocator.address.toLowerCase() === allocatorAddress),
  );
};

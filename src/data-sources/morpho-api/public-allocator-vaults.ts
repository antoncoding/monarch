import { publicAllocatorVaultsQuery } from '@/graphql/public-allocator-query';
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
 * Only returns vaults that have publicAllocatorConfig enabled (non-null).
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

  // Filter to only vaults with PA enabled
  return items.filter((vault): vault is PublicAllocatorVault => vault.publicAllocatorConfig !== null);
};

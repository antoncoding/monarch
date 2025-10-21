import { vaultV2Query } from '@/graphql/morpho-api-queries';
import { SupportedNetworks } from '@/utils/networks';
import { morphoGraphqlFetcher } from './fetchers';

// Re-export types from subgraph to maintain compatibility
// These types match the API response structure
export type VaultV2Cap = {
  relativeCap: string;
  absoluteCap: string;
  capId: string;
  idParams: string;
  oldRelativeCap?: string; // For delta calculation
  oldAbsoluteCap?: string; // For delta calculation
};

export type VaultV2Details = {
  id: string;
  asset: string;
  symbol: string;
  name: string;
  curator: string;
  owner: string;
  allocators: string[];
  sentinels: string[];
  caps: VaultV2Cap[];
  totalSupply: string;
  adapters: string[];
  avgApy?: number;
};

// API response types
type ApiVaultV2Cap = {
  id: string;
  idData: string;
  absoluteCap: number | string;
  relativeCap: string;
};

type ApiVaultV2 = {
  id: string;
  address: string;
  name: string;
  symbol: string;
  avgApy: number;
  totalSupply: string | number;
  asset: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  curator: {
    address: string;
  } | null;
  owner: {
    address: string;
  } | null;
  allocators: Array<{
    allocator: {
      address: string;
    };
  }>;
  caps: {
    items: ApiVaultV2Cap[];
  };
};

type VaultV2ApiResponse = {
  data: {
    vaultV2s: {
      items: ApiVaultV2[];
    };
  };
  errors?: Array<{ message: string }>;
};

/**
 * Transforms API cap response to internal VaultV2Cap format
 */
function transformCap(apiCap: ApiVaultV2Cap): VaultV2Cap {
  return {
    capId: apiCap.id,
    idParams: apiCap.idData,
    absoluteCap: String(apiCap.absoluteCap),
    relativeCap: apiCap.relativeCap,
  };
}

/**
 * Transforms API vault response to internal VaultV2Details format
 */
function transformVault(apiVault: ApiVaultV2): VaultV2Details {
  return {
    id: apiVault.id,
    asset: apiVault.asset.address,
    symbol: apiVault.symbol,
    name: apiVault.name,
    curator: apiVault.curator?.address ?? '',
    owner: apiVault.owner?.address ?? '',
    allocators: apiVault.allocators.map((a) => a.allocator.address),
    sentinels: [], // Not available in API response
    caps: apiVault.caps.items.map(transformCap),
    totalSupply: String(apiVault.totalSupply),
    adapters: [], // Not available in API response
    avgApy: apiVault.avgApy,
  };
}

/**
 * Fetches VaultV2 details from Morpho API
 *
 * @param vaultAddress - The vault address
 * @param network - The network/chain ID
 * @returns VaultV2Details or null if not found
 */
export const fetchVaultV2Details = async (
  vaultAddress: string,
  network: SupportedNetworks,
): Promise<VaultV2Details | null> => {
  try {
    const variables = {
      address: vaultAddress.toLowerCase(),
      chainId: network,
    };

    const response = await morphoGraphqlFetcher<VaultV2ApiResponse>(vaultV2Query, variables);

    if (response.errors && response.errors.length > 0) {
      console.error('GraphQL errors:', response.errors);
      return null;
    }

    const vaults = response.data?.vaultV2s?.items;
    if (!vaults || vaults.length === 0) {
      console.log(`No V2 vault found for address ${vaultAddress} on network ${network}`);
      return null;
    }

    // Since we're querying by specific address, we should only get one result
    const vault = vaults[0];
    return transformVault(vault);
  } catch (error) {
    console.error(
      `Error fetching V2 vault details for ${vaultAddress} on network ${network}:`,
      error,
    );
    return null;
  }
};

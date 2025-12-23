import { vaultV2Query } from '@/graphql/morpho-api-queries';
import type { SupportedNetworks } from '@/utils/networks';
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
  address: string;
  asset: string;
  symbol: string;
  name: string;
  curator: string;
  owner: string;
  allocators: string[];
  sentinels: string[];
  caps: VaultV2Cap[];
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
  allocators: {
    allocator: {
      address: string;
    };
  }[];
  caps: {
    items: ApiVaultV2Cap[];
  };
};

type VaultV2ApiResponse = {
  data: {
    vaultV2ByAddress: ApiVaultV2 | null;
  };
  errors?: { message: string }[];
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
    address: apiVault.address,
    asset: apiVault.asset.address,
    symbol: apiVault.symbol,
    name: apiVault.name,
    curator: apiVault.curator?.address ?? '',
    owner: apiVault.owner?.address ?? '',
    allocators: apiVault.allocators.map((a) => a.allocator.address),
    sentinels: [], // Not available in API response
    caps: apiVault.caps.items.map(transformCap),
    adapters: [], // Not available in API response
    avgApy: apiVault.avgApy,
  };
}

/**
 * Core function to fetch VaultV2 details from Morpho API
 * Handles both single and multiple vault addresses
 * Note: API only accepts one address at a time, so we fetch individually
 *
 * @param vaultAddresses - Array of vault addresses
 * @param network - The network/chain ID
 * @returns Array of VaultV2Details
 */
const fetchVaultV2DetailsCore = async (vaultAddresses: string[], network: SupportedNetworks): Promise<VaultV2Details[]> => {
  if (vaultAddresses.length === 0) {
    return [];
  }

  try {
    // Fetch each vault individually since API only accepts single address
    const promises = vaultAddresses.map(async (address) => {
      const variables = {
        address: address.toLowerCase(),
        chainId: network,
      };

      const response = await morphoGraphqlFetcher<VaultV2ApiResponse>(vaultV2Query, variables);

      if (response.errors && response.errors.length > 0) {
        console.error('GraphQL errors:', response.errors);
        return null;
      }

      const vault = response.data?.vaultV2ByAddress;
      if (!vault) {
        console.log(`No V2 vault found for address ${address} on network ${network}`);
        return null;
      }

      return transformVault(vault);
    });

    const results = await Promise.all(promises);
    return results.filter((vault): vault is VaultV2Details => vault !== null);
  } catch (error) {
    console.error(`Error fetching V2 vault details on network ${network}:`, error);
    return [];
  }
};

/**
 * Fetches a single VaultV2 details from Morpho API
 *
 * @param vaultAddress - The vault address
 * @param network - The network/chain ID
 * @returns VaultV2Details or null if not found
 */
export const fetchVaultV2Details = async (vaultAddress: string, network: SupportedNetworks): Promise<VaultV2Details | null> => {
  const results = await fetchVaultV2DetailsCore([vaultAddress], network);
  return results.length > 0 ? results[0] : null;
};

/**
 * Fetches multiple VaultV2 details from Morpho API for a single network
 *
 * @param vaultAddresses - Array of vault addresses
 * @param network - The network/chain ID
 * @returns Array of VaultV2Details
 */
export const fetchMultipleVaultV2Details = async (vaultAddresses: string[], network: SupportedNetworks): Promise<VaultV2Details[]> => {
  return fetchVaultV2DetailsCore(vaultAddresses, network);
};

/**
 * Fetches multiple VaultV2 details from Morpho API across multiple networks
 * Groups addresses by network and fetches them efficiently
 *
 * @param vaultAddressesWithNetwork - Array of vault addresses with their network IDs
 * @returns Array of VaultV2Details with networkId
 */
export const fetchMultipleVaultV2DetailsAcrossNetworks = async (
  vaultAddressesWithNetwork: {
    address: string;
    networkId: SupportedNetworks;
  }[],
): Promise<(VaultV2Details & { networkId: SupportedNetworks })[]> => {
  if (vaultAddressesWithNetwork.length === 0) {
    return [];
  }

  // Group addresses by network
  const addressesByNetwork = vaultAddressesWithNetwork.reduce(
    (acc, item) => {
      if (!acc[item.networkId]) {
        acc[item.networkId] = [];
      }
      acc[item.networkId].push(item.address);
      return acc;
    },
    {} as Record<SupportedNetworks, string[]>,
  );

  // Fetch details for each network in parallel
  const promises = Object.entries(addressesByNetwork).map(async ([networkIdStr, addresses]) => {
    const networkId = Number(networkIdStr) as SupportedNetworks;
    const details = await fetchMultipleVaultV2Details(addresses, networkId);
    // Add network ID to each vault detail
    return details.map((detail) => ({
      ...detail,
      networkId,
    }));
  });

  const results = await Promise.all(promises);
  return results.flat();
};

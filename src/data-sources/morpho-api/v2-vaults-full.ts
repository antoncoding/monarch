import type { Address } from 'viem';
import type { VaultV2Details } from '@/data-sources/morpho-api/v2-vaults';
import { vaultV2sOwnerQuery } from '@/graphql/morpho-api-queries';
import { type SupportedNetworks, networks, isAgentAvailable } from '@/utils/networks';
import { morphoGraphqlFetcher } from '@/data-sources/morpho-api/fetchers';
import { getDeployedVaults } from '@/utils/vault-storage';

// Vault address with network information
export type UserVaultV2Address = {
  address: string;
  networkId: SupportedNetworks;
};

// User vault with full details and network info
// This is used by the autovault page to display user's vaults
export type UserVaultV2 = VaultV2Details & {
  networkId: SupportedNetworks;
  balance?: bigint; // User's redeemable assets (from previewRedeem)
  adapter?: Address; // MorphoMarketV1Adapter address
};

// Lightweight API response for owner lookup
type VaultV2OwnerItem = {
  address: string;
  owner: { address: string } | null;
  chain: { id: number };
};

type VaultV2sOwnerApiResponse = {
  data?: {
    vaultV2s?: {
      items: VaultV2OwnerItem[];
      pageInfo: {
        countTotal: number;
      };
    };
  };
  errors?: { message: string }[];
};

/**
 * Fetches V2 vaults for a specific network from the Morpho API and filters by owner.
 * Merges with locally cached vaults for newly deployed vaults not yet indexed.
 */
export const fetchUserVaultV2Addresses = async (owner: string, network: SupportedNetworks): Promise<UserVaultV2Address[]> => {
  if (!isAgentAvailable(network)) {
    return [];
  }

  const normalizedOwner = owner.toLowerCase();
  const PAGE_SIZE = 100;
  const apiVaults: UserVaultV2Address[] = [];
  let skip = 0;
  let hasMore = true;

  // Step 1: Get locally cached vaults for this network
  const localVaults = getDeployedVaults(owner)
    .filter((v) => v.chainId === network)
    .map((v) => ({
      address: v.address,
      networkId: network,
    }));

  // Step 2: Fetch from Morpho API
  try {
    while (hasMore) {
      const response = await morphoGraphqlFetcher<VaultV2sOwnerApiResponse>(vaultV2sOwnerQuery, {
        first: PAGE_SIZE,
        skip,
      });

      if (!response?.data?.vaultV2s) {
        break;
      }

      const items = response.data.vaultV2s.items;

      for (const vault of items) {
        if (vault.chain.id === network && vault.owner?.address.toLowerCase() === normalizedOwner) {
          apiVaults.push({
            address: vault.address,
            networkId: network,
          });
        }
      }

      const totalCount = response.data.vaultV2s.pageInfo.countTotal;
      skip += PAGE_SIZE;
      hasMore = skip < totalCount && items.length === PAGE_SIZE;
    }
  } catch (error) {
    console.error(`Error fetching V2 vault addresses for owner ${owner} on network ${network}:`, error);
  }

  // Step 3: Merge and deduplicate
  const seenAddresses = new Set(apiVaults.map((v) => v.address.toLowerCase()));
  const uniqueLocalVaults = localVaults.filter((v) => !seenAddresses.has(v.address.toLowerCase()));

  return [...uniqueLocalVaults, ...apiVaults];
};

/**
 * Fetches vault addresses from all networks that support V2 vaults.
 * Merges results from Morpho API with locally cached vaults (for newly deployed vaults
 * that haven't been indexed yet).
 */
export const fetchUserVaultV2AddressesAllNetworks = async (owner: string): Promise<UserVaultV2Address[]> => {
  const normalizedOwner = owner.toLowerCase();
  const PAGE_SIZE = 100;
  const apiVaults: UserVaultV2Address[] = [];
  let skip = 0;
  let hasMore = true;

  const supportedNetworkIds = new Set(networks.filter((network) => isAgentAvailable(network.network)).map((network) => network.network));

  if (supportedNetworkIds.size === 0) {
    return [];
  }

  // Step 1: Get locally cached vaults (recently deployed, may not be indexed yet)
  const localVaults = getDeployedVaults(owner)
    .filter((v) => supportedNetworkIds.has(v.chainId as SupportedNetworks))
    .map((v) => ({
      address: v.address,
      networkId: v.chainId as SupportedNetworks,
    }));

  // Step 2: Fetch from Morpho API
  try {
    while (hasMore) {
      const response = await morphoGraphqlFetcher<VaultV2sOwnerApiResponse>(vaultV2sOwnerQuery, {
        first: PAGE_SIZE,
        skip,
      });

      if (!response?.data?.vaultV2s) {
        break;
      }

      const items = response.data.vaultV2s.items;

      for (const vault of items) {
        if (supportedNetworkIds.has(vault.chain.id as SupportedNetworks) && vault.owner?.address.toLowerCase() === normalizedOwner) {
          apiVaults.push({
            address: vault.address,
            networkId: vault.chain.id as SupportedNetworks,
          });
        }
      }

      const totalCount = response.data.vaultV2s.pageInfo.countTotal;
      skip += PAGE_SIZE;
      hasMore = skip < totalCount && items.length === PAGE_SIZE;
    }
  } catch (error) {
    console.error('Error fetching V2 vault addresses across networks:', error);
    // Continue with local vaults even if API fails
  }

  // Step 3: Merge and deduplicate (API results take precedence for ordering)
  const seenAddresses = new Set(apiVaults.map((v) => v.address.toLowerCase()));
  const uniqueLocalVaults = localVaults.filter((v) => !seenAddresses.has(v.address.toLowerCase()));

  // Local vaults first (newest), then API vaults
  return [...uniqueLocalVaults, ...apiVaults];
};

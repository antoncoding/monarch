import type { Address } from 'viem';
import type { VaultV2Details } from '@/data-sources/morpho-api/v2-vaults';
import { userVaultsV2AddressesQuery } from '@/graphql/morpho-v2-subgraph-queries';
import { type SupportedNetworks, getAgentConfig, networks, isAgentAvailable } from '@/utils/networks';
import { subgraphGraphqlFetcher } from './fetchers';

// Simplified subgraph response for vault addresses
type SubgraphVaultV2Address = {
  id: string; // Vault address
};

// Response structure for user vaults query (only addresses)
type SubgraphUserVaultsV2Response = {
  data: {
    vaultV2S: SubgraphVaultV2Address[];
  };
  errors?: any[];
};

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

/**
 * Fetches only vault addresses owned by a user from the subgraph
 * This is the first step - get addresses, then fetch details from Morpho API
 */
export const fetchUserVaultV2Addresses = async (owner: string, network: SupportedNetworks): Promise<UserVaultV2Address[]> => {
  const agentConfig = getAgentConfig(network);

  if (!agentConfig?.adapterSubgraphEndpoint) {
    // No subgraph configured for this network
    return [];
  }

  const subgraphUrl = agentConfig.adapterSubgraphEndpoint;

  try {
    const variables = {
      owner: owner.toLowerCase(),
    };

    const response = await subgraphGraphqlFetcher<SubgraphUserVaultsV2Response>(subgraphUrl, userVaultsV2AddressesQuery, variables);

    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      return [];
    }

    const vaults = response.data?.vaultV2S;
    if (!vaults || vaults.length === 0) {
      // No vaults found for this owner on this network
      return [];
    }

    // Convert to UserVaultV2Address with network information
    return vaults.map((vault) => ({
      address: vault.id,
      networkId: network,
    }));
  } catch (error) {
    console.error(`Error fetching V2 vault addresses for owner ${owner} on network ${network}:`, error);
    return [];
  }
};

/**
 * Fetches vault addresses from all networks that support V2 vaults
 */
export const fetchUserVaultV2AddressesAllNetworks = async (owner: string): Promise<UserVaultV2Address[]> => {
  const supportedNetworks = networks.filter((network) => isAgentAvailable(network.network)).map((network) => network.network);

  const promises = supportedNetworks.map(async (network) => {
    return fetchUserVaultV2Addresses(owner, network);
  });

  const results = await Promise.all(promises);
  return results.flat();
};

import { userVaultsV2Query, vaultV2Query } from '@/graphql/morpho-v2-subgraph-queries';
import { SupportedNetworks, getAgentConfig, networks, isAgentAvailable } from '@/utils/networks';
import { subgraphGraphqlFetcher } from './fetchers';

// Define the expected structure of V2 vault creation events
export type SubgraphVaultV2 = {
  id: string; // Transaction hash + log index
  owner: string; // Vault owner address
  asset: string; // Asset address
  newVaultV2: string; // Deployed vault address
};

// Response structure for user vaults query
type SubgraphUserVaultsV2Response = {
  data: {
    createVaultV2S: SubgraphVaultV2[];
  };
  errors?: any[];
};

// Enhanced vault type with network information
export type UserVaultV2 = SubgraphVaultV2 & {
  networkId: SupportedNetworks;
  balance?: bigint; // vault total assets
};

// Vault V2 details from subgraph
export type VaultV2Cap = {
  relativeCap: string;
  absoluteCap: string;
  capId: string;
  idParams: string;
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
  adopters: string[];
};

type SubgraphVaultV2Response = {
  data: {
    vaultV2: {
      id: string;
      asset: string;
      symbol: string;
      name: string;
      curator: string;
      owner: string;
      allocators: { account: string }[];
      sentinels: { account: string }[];
      caps: VaultV2Cap[];
      totalSupply: string;
      adopters: { address: string }[];
    } | null;
  };
  errors?: any[];
};

export const fetchUserVaultsV2 = async (
  owner: string,
  network: SupportedNetworks,
): Promise<UserVaultV2[]> => {
  const agentConfig = getAgentConfig(network);

  if (!agentConfig?.vaultsSubgraphEndpoint) {
    console.log(`No subgraph endpoint configured for network ${network}`);
    return [];
  }

  const subgraphUrl = agentConfig.vaultsSubgraphEndpoint;
  const userVaults: UserVaultV2[] = [];

  try {
    const variables = {
      owner: owner.toLowerCase(),
    };

    const response = await subgraphGraphqlFetcher<SubgraphUserVaultsV2Response>(
      subgraphUrl,
      userVaultsV2Query,
      variables,
    );

    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      return [];
    }

    const vaults = response.data?.createVaultV2S;
    if (!vaults) {
      console.log(`No V2 vaults found for owner ${owner} on network ${network}`);
      return [];
    }

    // Add network information to each vault
    vaults.forEach((vault) => {
      userVaults.push({
        ...vault,
        networkId: network,
      });
    });

    console.log(`Fetched ${userVaults.length} V2 vaults for owner ${owner} on network ${network}`);
  } catch (error) {
    console.error(
      `Error fetching V2 vaults for owner ${owner} on network ${network}:`,
      error,
    );
  }

  return userVaults;
};

// Fetch vaults from all networks that support V2 vaults
export const fetchUserVaultsV2AllNetworks = async (owner: string): Promise<UserVaultV2[]> => {
  const supportedNetworks = networks
    .filter(network => isAgentAvailable(network.network))
    .map(network => network.network);

  const promises = supportedNetworks.map(async (network) => {
    return fetchUserVaultsV2(owner, network);
  });

  const results = await Promise.all(promises);
  return results.flat();
};

export const fetchVaultV2Details = async (
  vaultAddress: string,
  network: SupportedNetworks,
): Promise<VaultV2Details | null> => {
  const agentConfig = getAgentConfig(network);

  // fetch from the adapter 
  if (!agentConfig?.adapterSubgraphEndpoint) {
    console.log(`No subgraph endpoint configured for network ${network}`);
    return null;
  }

  const subgraphUrl = agentConfig.adapterSubgraphEndpoint;

  try {
    const variables = {
      id: vaultAddress.toLowerCase(),
    };

    const response = await subgraphGraphqlFetcher<SubgraphVaultV2Response>(
      subgraphUrl,
      vaultV2Query,
      variables,
    );

    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      return null;
    }

    const vault = response.data?.vaultV2;
    if (!vault) {
      console.log(`No V2 vault found for address ${vaultAddress} on network ${network}`);
      return null;
    }

    return {
      id: vault.id,
      asset: vault.asset,
      symbol: vault.symbol,
      name: vault.name,
      curator: vault.curator,
      owner: vault.owner,
      allocators: vault.allocators.map((a) => a.account),
      sentinels: vault.sentinels.map((s) => s.account),
      caps: vault.caps,
      totalSupply: vault.totalSupply,
      adopters: vault.adopters.map((a) => a.address),
    };
  } catch (error) {
    console.error(
      `Error fetching V2 vault details for ${vaultAddress} on network ${network}:`,
      error,
    );
    return null;
  }
};
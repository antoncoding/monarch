import { MORPHO_API_SUPPORTED_NETWORKS, supportsMorphoApiChainId } from '@/config/dataSources';
import { allVaultsQuery, vaultApysQuery, vaultV2MetadataQuery, vaultV2RewardsQuery } from '@/graphql/vault-queries';
import { morphoGraphqlFetcher } from './fetchers';

export type VaultAddressByNetwork = {
  address: string;
  chainId?: number;
  networkId?: number;
};

// Constants for Morpho listed vault fetching
const MORPHO_SUPPORTED_CHAIN_IDS = MORPHO_API_SUPPORTED_NETWORKS;
const MAX_VAULTS_PAGE_SIZE = 500;
const MAX_VAULT_V2_METADATA_PAGE_SIZE = 500;

// Type for vault from Morpho API
export type MorphoVault = {
  address: string;
  chainId: number;
  name: string;
  featured: boolean;
  totalAssets: string;
  assetAddress: string;
  assetSymbol: string;
  metadataDescription?: string;
  metadataImage?: string;
};

export type MorphoVaultV2Metadata = {
  address: string;
  assetAddress: string;
  assetSymbol: string;
  chainId: number;
  listed: boolean;
  metadataDescription?: string;
  metadataImage?: string;
  name: string;
  symbol: string;
};

export type MorphoVaultV2Reward = {
  supplyApr: number;
  asset: {
    address: string;
    symbol: string;
    price?: {
      usd?: number | null;
    } | null;
  };
};

export type MorphoVaultV2Rewards = {
  address: string;
  apy: number | null;
  rewards: MorphoVaultV2Reward[];
};

// API response types
type ApiVault = {
  address: string;
  chain: {
    id: number;
  };
  name: string;
  featured: boolean;
  metadata?: {
    description?: string | null;
    image?: string | null;
  } | null;
  state: {
    apy?: number | null;
    totalAssets: string;
  };
  asset: {
    address: string;
    symbol: string;
  };
};

type AllVaultsApiResponse = {
  data?: {
    vaults?: {
      items?: ApiVault[];
      pageInfo?: {
        countTotal: number;
      };
    };
  };
  errors?: { message: string }[];
};

type VaultApysApiResponse = {
  data?: {
    vaults?: {
      items?: Pick<ApiVault, 'address' | 'chain' | 'state'>[];
    };
  };
  errors?: { message: string }[];
};

type ApiVaultV2 = {
  address: string;
  asset: {
    address: string;
    symbol: string;
  };
  chain: {
    id: number;
  };
  listed: boolean;
  metadata?: {
    description?: string | null;
    image?: string | null;
  } | null;
  name: string;
  symbol: string;
};

type VaultV2MetadataApiResponse = {
  data?: {
    vaultV2s?: {
      items?: ApiVaultV2[];
    };
  };
  errors?: { message: string }[];
};

type VaultV2RewardsApiResponse = {
  data?: {
    vaultV2ByAddress?: MorphoVaultV2Rewards | null;
  };
  errors?: { message: string }[];
};

const getVaultApyKey = (address: string, chainId: number) => `${address.toLowerCase()}-${chainId}`;
const getVaultNetworkId = (vault: VaultAddressByNetwork) => vault.chainId ?? vault.networkId;
const getSupportedVaultNetworkId = (vault: VaultAddressByNetwork) => {
  const chainId = getVaultNetworkId(vault);
  return chainId != null && supportsMorphoApiChainId(chainId) ? chainId : null;
};
const getVaultRequestKey = (vault: VaultAddressByNetwork) => {
  const chainId = getSupportedVaultNetworkId(vault);
  return chainId ? `${chainId}:${vault.address.toLowerCase()}` : null;
};

/**
 * Transforms API vault response to internal MorphoVault format
 */
function transformVault(apiVault: ApiVault): MorphoVault {
  return {
    address: apiVault.address,
    chainId: apiVault.chain.id,
    name: apiVault.name,
    featured: apiVault.featured,
    totalAssets: apiVault.state.totalAssets,
    assetAddress: apiVault.asset.address,
    assetSymbol: apiVault.asset.symbol,
    metadataDescription: apiVault.metadata?.description ?? undefined,
    metadataImage: apiVault.metadata?.image ?? undefined,
  };
}

function transformVaultV2Metadata(apiVault: ApiVaultV2): MorphoVaultV2Metadata {
  return {
    address: apiVault.address,
    assetAddress: apiVault.asset.address,
    assetSymbol: apiVault.asset.symbol,
    chainId: apiVault.chain.id,
    listed: apiVault.listed,
    metadataDescription: apiVault.metadata?.description ?? undefined,
    metadataImage: apiVault.metadata?.image ?? undefined,
    name: apiVault.name,
    symbol: apiVault.symbol,
  };
}

/**
 * Fetches listed vaults from Morpho API across supported chains
 *
 * @returns Array of MorphoVault
 */
export const fetchAllMorphoVaults = async (): Promise<MorphoVault[]> => {
  try {
    const vaults: ApiVault[] = [];

    for (let skip = 0; ; skip += MAX_VAULTS_PAGE_SIZE) {
      const response = await morphoGraphqlFetcher<AllVaultsApiResponse>(allVaultsQuery, {
        first: MAX_VAULTS_PAGE_SIZE,
        skip,
        where: {
          listed: true,
          chainId_in: MORPHO_SUPPORTED_CHAIN_IDS,
        },
      });

      const items = response?.data?.vaults?.items ?? [];
      vaults.push(...items);

      const totalCount = response?.data?.vaults?.pageInfo?.countTotal ?? vaults.length;
      if (items.length === 0 || vaults.length >= totalCount) {
        break;
      }
    }

    return vaults.map(transformVault);
  } catch (error) {
    console.error('Error fetching all Morpho vaults:', error);
    return [];
  }
};

export const fetchMorphoVaultV2Metadata = async (vaults: VaultAddressByNetwork[]): Promise<MorphoVaultV2Metadata[]> => {
  const vaultsByKey = new Map<string, VaultAddressByNetwork>();
  for (const vault of vaults) {
    const key = getVaultRequestKey(vault);
    if (key) {
      vaultsByKey.set(key, vault);
    }
  }

  const requestedKeys = new Set(vaultsByKey.keys());
  if (requestedKeys.size === 0) {
    return [];
  }

  const uniqueVaults = Array.from(vaultsByKey.values());
  const addresses = Array.from(new Set(uniqueVaults.map((vault) => vault.address.toLowerCase())));
  const chainIds = Array.from(
    new Set(uniqueVaults.map((vault) => getSupportedVaultNetworkId(vault)).filter((chainId): chainId is number => chainId !== null)),
  );

  const metadataByKey = new Map<string, MorphoVaultV2Metadata>();

  try {
    for (let skip = 0; ; skip += MAX_VAULT_V2_METADATA_PAGE_SIZE) {
      const response = await morphoGraphqlFetcher<VaultV2MetadataApiResponse>(vaultV2MetadataQuery, {
        first: MAX_VAULT_V2_METADATA_PAGE_SIZE,
        skip,
        where: {
          address_in: addresses,
          chainId_in: chainIds,
        },
      });

      const items = response?.data?.vaultV2s?.items ?? [];
      for (const item of items) {
        const key = getVaultRequestKey({ address: item.address, chainId: item.chain.id });
        if (!key || !requestedKeys.has(key)) {
          continue;
        }

        metadataByKey.set(key, transformVaultV2Metadata(item));
      }

      if (items.length < MAX_VAULT_V2_METADATA_PAGE_SIZE) {
        break;
      }
    }

    return Array.from(metadataByKey.values());
  } catch (error) {
    console.warn('Error fetching Morpho V2 vault metadata:', error);
    return [];
  }
};

export const fetchListedMorphoVaultV2Metadata = async (): Promise<MorphoVaultV2Metadata[]> => {
  const metadata: MorphoVaultV2Metadata[] = [];

  try {
    for (let skip = 0; ; skip += MAX_VAULT_V2_METADATA_PAGE_SIZE) {
      const response = await morphoGraphqlFetcher<VaultV2MetadataApiResponse>(vaultV2MetadataQuery, {
        first: MAX_VAULT_V2_METADATA_PAGE_SIZE,
        skip,
        where: {
          chainId_in: MORPHO_SUPPORTED_CHAIN_IDS,
          listed: true,
        },
      });

      const items = response?.data?.vaultV2s?.items ?? [];
      metadata.push(...items.map(transformVaultV2Metadata));

      if (items.length < MAX_VAULT_V2_METADATA_PAGE_SIZE) {
        break;
      }
    }

    return metadata;
  } catch (error) {
    console.warn('Error fetching listed Morpho V2 vault metadata:', error);
    return [];
  }
};

export const fetchMorphoVaultV2Rewards = async (vaultAddress: string, chainId: number): Promise<MorphoVaultV2Rewards | null> => {
  if (!supportsMorphoApiChainId(chainId)) {
    return null;
  }

  try {
    const response = await morphoGraphqlFetcher<VaultV2RewardsApiResponse>(vaultV2RewardsQuery, {
      address: vaultAddress.toLowerCase(),
      chainId,
    });

    const vault = response?.data?.vaultV2ByAddress;
    if (!vault) {
      return null;
    }

    return {
      ...vault,
      rewards: Array.isArray(vault.rewards) ? vault.rewards : [],
    };
  } catch (error) {
    console.warn('Error fetching Morpho V2 vault rewards:', error);
    return null;
  }
};

export const fetchMorphoVaultApys = async (vaults: VaultAddressByNetwork[]): Promise<Map<string, number>> => {
  if (vaults.length === 0) {
    return new Map();
  }

  const supportedVaults = vaults.filter((vault) => getVaultRequestKey(vault));
  const requestedKeys = new Set(
    supportedVaults
      .map((vault) => {
        const chainId = getSupportedVaultNetworkId(vault);
        return chainId ? getVaultApyKey(vault.address, chainId) : null;
      })
      .filter((key): key is string => Boolean(key)),
  );
  if (requestedKeys.size === 0) {
    return new Map();
  }

  const addresses = [...new Set(supportedVaults.map((vault) => vault.address.toLowerCase()))];
  const chainIds = [
    ...new Set(supportedVaults.map((vault) => getSupportedVaultNetworkId(vault)).filter((chainId): chainId is number => chainId !== null)),
  ];

  try {
    const response = await morphoGraphqlFetcher<VaultApysApiResponse>(vaultApysQuery, {
      first: addresses.length * chainIds.length,
      where: {
        address_in: addresses,
        chainId_in: chainIds,
      },
    });

    if (!response) {
      return new Map();
    }

    const items = response.data?.vaults?.items ?? [];
    const apys = new Map<string, number>();

    for (const vault of items) {
      const key = getVaultApyKey(vault.address, vault.chain.id);
      const apy = vault.state.apy;
      if (apy === null || apy === undefined) {
        continue;
      }
      if (!requestedKeys.has(key)) {
        continue;
      }
      apys.set(key, apy);
    }

    return apys;
  } catch (error) {
    console.warn('Error fetching Morpho vault APYs:', error);
    return new Map();
  }
};

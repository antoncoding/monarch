import { allVaultsQuery, vaultApysQuery } from '@/graphql/vault-queries';
import { morphoGraphqlFetcher } from './fetchers';

type VaultAddressByNetwork = {
  address: string;
  networkId: number;
};

// Constants for Morpho vault fetching
const MORPHO_SUPPORTED_CHAIN_IDS = [1, 8453, 999, 137, 42_161, 130];
const MAX_VAULTS_LIMIT = 500;

// Type for vault from Morpho API
export type MorphoVault = {
  address: string;
  chainId: number;
  name: string;
  totalAssets: string;
  assetAddress: string;
  assetSymbol: string;
};

// API response types
type ApiVault = {
  address: string;
  chain: {
    id: number;
  };
  name: string;
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

const getVaultApyKey = (address: string, chainId: number) => `${address.toLowerCase()}-${chainId}`;

/**
 * Transforms API vault response to internal MorphoVault format
 */
function transformVault(apiVault: ApiVault): MorphoVault {
  return {
    address: apiVault.address,
    chainId: apiVault.chain.id,
    name: apiVault.name,
    totalAssets: apiVault.state.totalAssets,
    assetAddress: apiVault.asset.address,
    assetSymbol: apiVault.asset.symbol,
  };
}

/**
 * Fetches all whitelisted vaults from Morpho API across supported chains
 *
 * @returns Array of MorphoVault
 */
export const fetchAllMorphoVaults = async (): Promise<MorphoVault[]> => {
  try {
    const variables = {
      first: MAX_VAULTS_LIMIT,
      where: {
        listed: true,
        chainId_in: MORPHO_SUPPORTED_CHAIN_IDS,
      },
    };

    const response = await morphoGraphqlFetcher<AllVaultsApiResponse>(allVaultsQuery, variables);

    // Handle NOT_FOUND - return empty array
    if (!response) {
      return [];
    }

    const vaults = response.data?.vaults?.items;
    if (!vaults || vaults.length === 0) {
      console.log('No whitelisted vaults found');
      return [];
    }

    return vaults.map(transformVault);
  } catch (error) {
    console.error('Error fetching all Morpho vaults:', error);
    return [];
  }
};

export const fetchMorphoVaultApys = async (vaults: VaultAddressByNetwork[]): Promise<Map<string, number>> => {
  if (vaults.length === 0) {
    return new Map();
  }

  const requestedKeys = new Set(vaults.map((vault) => getVaultApyKey(vault.address, vault.networkId)));

  try {
    const response = await morphoGraphqlFetcher<VaultApysApiResponse>(vaultApysQuery, {
      first: vaults.length,
      where: {
        address_in: vaults.map((vault) => vault.address.toLowerCase()),
        chainId_in: [...new Set(vaults.map((vault) => vault.networkId))],
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

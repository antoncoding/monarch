import { allVaultsQuery } from '@/graphql/vault-queries';
import { morphoGraphqlFetcher } from './fetchers';

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
    totalAssets: string;
  };
  asset: {
    address: string;
    symbol: string;
  };
};

type AllVaultsApiResponse = {
  data: {
    vaults: {
      items: ApiVault[];
    };
  };
  errors?: { message: string }[];
};

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
      first: 500,
      where: {
        whitelisted: true,
        chainId_in: [1, 8453, 999, 137, 42161, 130],
      },
    };

    const response = await morphoGraphqlFetcher<AllVaultsApiResponse>(
      allVaultsQuery,
      variables,
    );

    if (response.errors && response.errors.length > 0) {
      console.error('GraphQL errors:', response.errors);
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

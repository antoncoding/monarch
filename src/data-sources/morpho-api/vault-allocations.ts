import { vaultAllocationQuery } from '@/graphql/vault-allocation-query';
import type { SupportedNetworks } from '@/utils/networks';
import { morphoGraphqlFetcher } from './fetchers';

export type VaultAllocationMarket = {
  uniqueKey: string;
  loanAsset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  collateralAsset: {
    address: string;
    symbol: string;
    decimals: number;
  } | null;
  oracleAddress: string;
  irmAddress: string;
  lltv: string;
  state: {
    supplyAssets: string;
    borrowAssets: string;
    liquidityAssets: string;
  };
};

export type VaultAllocation = {
  market: VaultAllocationMarket;
  supplyAssets: string;
  supplyCap: string;
};

export type VaultAllocationData = {
  address: string;
  name: string;
  symbol: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  state: {
    totalAssets: string;
    allocation: VaultAllocation[];
  };
};

type VaultAllocationApiResponse = {
  data?: {
    vaultByAddress?: VaultAllocationData | null;
  };
  errors?: { message: string }[];
};

/**
 * Fetches a MetaMorpho vault's allocation data from the Morpho Blue API.
 * Returns the vault's markets with their supply amounts and liquidity.
 */
export const fetchVaultAllocations = async (vaultAddress: string, chainId: SupportedNetworks): Promise<VaultAllocationData | null> => {
  const response = await morphoGraphqlFetcher<VaultAllocationApiResponse>(vaultAllocationQuery, {
    address: vaultAddress,
    chainId,
  });

  if (response?.errors?.length) {
    console.warn('fetchVaultAllocations errors:', response.errors);
  }

  if (!response?.data?.vaultByAddress) {
    return null;
  }

  return response.data.vaultByAddress;
};

import { morphoGraphqlFetcher } from './fetchers';

type VaultV2GraphItem = {
  id: string;
  name?: string | null;
  symbol?: string | null;
  totalSupply?: string | null;
  asset?: {
    id?: string | null;
    decimals?: number | null;
  } | null;
  curator?: {
    address?: string | null;
  } | null;
  allocators?: {
    allocator?: {
      address?: string | null;
    } | null;
  }[] | null;
};

type VaultV2GraphResponse = {
  vaultV2s: {
    items: VaultV2GraphItem[];
  };
};

const VAULT_V2_QUERY = /* GraphQL */ `
  query VaultV2Query($address: String!, $chainId: Int!) {
    vaultV2s(where: { chainId_in: [$chainId], address_in: [$address] }) {
      items {
        id
        name
        symbol
        totalSupply
        asset {
          id
          decimals
        }
        curator {
          address
        }
        allocators {
          allocator {
            address
          }
        }
      }
    }
  }
`;

export async function fetchVaultV2({
  address,
  chainId,
}: {
  address: string;
  chainId: number;
}): Promise<VaultV2GraphItem | null> {
  const response = await morphoGraphqlFetcher<VaultV2GraphResponse>(VAULT_V2_QUERY, {
    address: address.toLowerCase(),
    chainId,
  });

  const item = response?.vaultV2s?.items?.[0];
  return item ?? null;
}

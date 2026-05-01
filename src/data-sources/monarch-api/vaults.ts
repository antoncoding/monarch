import type { Address } from 'viem';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import { monarchGraphqlFetcher } from './fetchers';

export type VaultV2Cap = {
  relativeCap: string;
  absoluteCap: string;
  capId: string;
  idParams: string;
  oldRelativeCap?: string;
  oldAbsoluteCap?: string;
};

export type VaultAdapterDetails = {
  adapterType: string;
  address: string;
  factoryAddress: string;
};

export type VaultAdapterAlias = {
  adapterType: string;
  address: string;
  chainId: SupportedNetworks;
  vaultAddress: string;
  vaultName: string;
};

export const MORPHO_MARKET_ADAPTER_TYPES = ['MorphoMarketV1AdapterV2', 'MorphoMarketV1Adapter'] as const;

export const isRecognizedMorphoMarketAdapterType = (adapterType: string | null | undefined): boolean => {
  return MORPHO_MARKET_ADAPTER_TYPES.some((candidate) => candidate === adapterType);
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
  adapterDetails: VaultAdapterDetails[];
  avgApy?: number;
};

export type UserVaultV2 = VaultV2Details & {
  networkId: SupportedNetworks;
  balance?: bigint;
  totalAssets?: bigint;
  adapter?: Address;
  actualApy?: number;
};

type MonarchVaultAllocator = {
  account: string;
  isAllocator: boolean;
};

type MonarchVaultSentinel = {
  account: string;
  isSentinel: boolean;
};

type MonarchVaultAdapter = {
  adapterAddress: string;
  isActive: boolean;
};

type MonarchVaultCap = {
  id: string;
  paramId: string;
  paramIdData: string;
  absoluteCap: string;
  relativeCap: string;
};

type MonarchVault = {
  id: string;
  vaultAddress: string;
  chainId: number;
  asset: string;
  symbol: string | null;
  name: string | null;
  owner: string;
  curator: string | null;
  allocators: MonarchVaultAllocator[];
  sentinels: MonarchVaultSentinel[];
  adapters: MonarchVaultAdapter[];
  caps: MonarchVaultCap[];
};

type MonarchAdapterRecord = {
  adapterAddress: string;
  adapterType: string;
  chainId: number;
  factoryAddress: string;
  vaultAddress: string;
};

type MonarchAdapterAliasRecord = MonarchAdapterRecord & {
  vault: {
    vaultAddress: string;
    chainId: number;
    name: string | null;
    symbol: string | null;
  } | null;
};

type MonarchVaultsResponse = {
  data?: {
    Vault?: MonarchVault[];
  };
};

type MonarchVaultDetailResponse = {
  data?: {
    Adapter?: MonarchAdapterRecord[];
    Vault?: MonarchVault[];
  };
};

type MonarchAdapterLookupResponse = {
  data?: {
    Adapter?: MonarchAdapterRecord[];
  };
};

type MonarchAdapterAliasesResponse = {
  data?: {
    Adapter?: MonarchAdapterAliasRecord[];
  };
};

const MONARCH_ADAPTER_ALIAS_PAGE_SIZE = 1000;
const MONARCH_ADAPTER_ALIAS_MAX_PAGES = 20;

const MONARCH_VAULT_FIELDS = `
  id
  vaultAddress
  chainId
  asset
  symbol
  name
  owner
  curator
  allocators {
    account
    isAllocator
  }
  sentinels {
    account
    isSentinel
  }
  adapters {
    adapterAddress
    isActive
  }
  caps {
    id
    paramId
    paramIdData
    absoluteCap
    relativeCap
  }
`;

const normalizeAddress = (value: string | null | undefined): string => value?.toLowerCase() ?? '';

const toSupportedNetwork = (chainId: number): SupportedNetworks | null => {
  return ALL_SUPPORTED_NETWORKS.includes(chainId as SupportedNetworks) ? (chainId as SupportedNetworks) : null;
};

const transformCap = (cap: MonarchVaultCap): VaultV2Cap => {
  return {
    capId: cap.paramId,
    idParams: cap.paramIdData,
    absoluteCap: cap.absoluteCap,
    relativeCap: cap.relativeCap,
  };
};

const transformAdapterRecord = (adapter: MonarchAdapterRecord): VaultAdapterDetails => {
  return {
    address: normalizeAddress(adapter.adapterAddress),
    adapterType: adapter.adapterType,
    factoryAddress: normalizeAddress(adapter.factoryAddress),
  };
};

const transformVault = (vault: MonarchVault, adapterDetails: VaultAdapterDetails[] = []): UserVaultV2 | null => {
  const networkId = toSupportedNetwork(vault.chainId);
  if (!networkId) {
    return null;
  }

  const activeAdapters = vault.adapters.filter((adapter) => adapter.isActive).map((adapter) => normalizeAddress(adapter.adapterAddress));
  const activeAllocators = vault.allocators
    .filter((allocator) => allocator.isAllocator)
    .map((allocator) => normalizeAddress(allocator.account));
  const activeSentinels = vault.sentinels.filter((sentinel) => sentinel.isSentinel).map((sentinel) => normalizeAddress(sentinel.account));

  return {
    id: vault.id,
    address: normalizeAddress(vault.vaultAddress),
    asset: normalizeAddress(vault.asset),
    symbol: vault.symbol ?? '',
    name: vault.name ?? '',
    curator: normalizeAddress(vault.curator),
    owner: normalizeAddress(vault.owner),
    allocators: activeAllocators,
    sentinels: activeSentinels,
    caps: vault.caps.map(transformCap),
    adapters: activeAdapters,
    adapterDetails,
    adapter: activeAdapters[0] as Address | undefined,
    networkId,
  };
};

const userVaultsQuery = `
  query MonarchUserVaults($owner: String!) {
    Vault(where: { owner: { _eq: $owner } }, order_by: [{ lastUpdate: desc }]) {
      ${MONARCH_VAULT_FIELDS}
    }
  }
`;

const vaultByAddressQuery = `
  query MonarchVaultByAddress($address: String!, $chainId: Int!) {
    Vault(where: { vaultAddress: { _eq: $address }, chainId: { _eq: $chainId } }, limit: 1) {
      ${MONARCH_VAULT_FIELDS}
    }
    Adapter(where: { vaultAddress: { _eq: $address }, chainId: { _eq: $chainId } }, order_by: [{ createdAt: desc }]) {
      adapterAddress
      adapterType
      chainId
      factoryAddress
      vaultAddress
    }
  }
`;

const adaptersByAddressQuery = `
  query MonarchAdaptersByAddress($adapterAddresses: [String!]!, $chainId: Int!) {
    Adapter(where: { adapterAddress: { _in: $adapterAddresses }, chainId: { _eq: $chainId } }, order_by: [{ createdAt: desc }]) {
      adapterAddress
      adapterType
      chainId
      factoryAddress
      vaultAddress
    }
  }
`;

const adapterAliasesQuery = `
  query MonarchVaultAdapterAliases($adapterTypes: [String!]!, $limit: Int!, $offset: Int!) {
    Adapter(
      where: { adapterType: { _in: $adapterTypes } }
      order_by: [{ createdAt: desc }]
      limit: $limit
      offset: $offset
    ) {
      adapterAddress
      adapterType
      chainId
      vaultAddress
      vault {
        vaultAddress
        chainId
        name
        symbol
      }
    }
  }
`;

export const fetchUserVaultV2DetailsAllNetworks = async (owner: string): Promise<UserVaultV2[]> => {
  const response = await monarchGraphqlFetcher<MonarchVaultsResponse>(userVaultsQuery, {
    owner: owner.toLowerCase(),
  });

  const vaults = response.data?.Vault ?? [];
  return vaults.map((vault) => transformVault(vault)).filter((vault): vault is UserVaultV2 => vault !== null);
};

export const fetchMonarchVaultDetails = async (vaultAddress: string, chainId: SupportedNetworks): Promise<UserVaultV2 | null> => {
  const response = await monarchGraphqlFetcher<MonarchVaultDetailResponse>(vaultByAddressQuery, {
    address: vaultAddress.toLowerCase(),
    chainId,
  });

  const vault = response.data?.Vault?.[0];
  if (!vault) {
    return null;
  }

  const activeAdapterAddresses = new Set(
    vault.adapters.filter((adapter) => adapter.isActive).map((adapter) => normalizeAddress(adapter.adapterAddress)),
  );
  const adapterDetails = (response.data?.Adapter ?? [])
    .map(transformAdapterRecord)
    .filter((adapter) => activeAdapterAddresses.has(adapter.address));

  return transformVault(vault, adapterDetails);
};

export const fetchMonarchAdaptersByAddress = async (
  adapterAddresses: string[],
  chainId: SupportedNetworks,
): Promise<VaultAdapterDetails[]> => {
  const normalizedAddresses = Array.from(new Set(adapterAddresses.map((address) => normalizeAddress(address)).filter(Boolean)));
  if (normalizedAddresses.length === 0) {
    return [];
  }

  const response = await monarchGraphqlFetcher<MonarchAdapterLookupResponse>(adaptersByAddressQuery, {
    adapterAddresses: normalizedAddresses,
    chainId,
  });

  const seenAddresses = new Set<string>();

  return (response.data?.Adapter ?? []).map(transformAdapterRecord).filter((adapter) => {
    if (seenAddresses.has(adapter.address)) {
      return false;
    }

    seenAddresses.add(adapter.address);
    return true;
  });
};

const transformAdapterAliasRecord = (adapter: MonarchAdapterAliasRecord): VaultAdapterAlias | null => {
  if (!isRecognizedMorphoMarketAdapterType(adapter.adapterType)) {
    return null;
  }

  const chainId = toSupportedNetwork(adapter.chainId);
  if (!chainId || (adapter.vault && adapter.vault.chainId !== adapter.chainId)) {
    return null;
  }

  const vaultAddress = normalizeAddress(adapter.vault?.vaultAddress ?? adapter.vaultAddress);
  const vaultName = adapter.vault?.name?.trim() || adapter.vault?.symbol?.trim() || '';
  if (!vaultName) {
    return null;
  }

  return {
    address: normalizeAddress(adapter.adapterAddress),
    adapterType: adapter.adapterType,
    chainId,
    vaultAddress,
    vaultName,
  };
};

export const fetchMonarchVaultAdapterAliases = async (): Promise<VaultAdapterAlias[]> => {
  try {
    const aliases: VaultAdapterAlias[] = [];
    const seenKeys = new Set<string>();

    for (let page = 0; page < MONARCH_ADAPTER_ALIAS_MAX_PAGES; page++) {
      const response = await monarchGraphqlFetcher<MonarchAdapterAliasesResponse>(adapterAliasesQuery, {
        adapterTypes: MORPHO_MARKET_ADAPTER_TYPES,
        limit: MONARCH_ADAPTER_ALIAS_PAGE_SIZE,
        offset: page * MONARCH_ADAPTER_ALIAS_PAGE_SIZE,
      });

      const records = response.data?.Adapter ?? [];
      for (const record of records) {
        const alias = transformAdapterAliasRecord(record);
        if (!alias) {
          continue;
        }

        const key = `${alias.chainId}:${alias.address}`;
        if (seenKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        aliases.push(alias);
      }

      if (records.length < MONARCH_ADAPTER_ALIAS_PAGE_SIZE) {
        break;
      }
    }

    return aliases;
  } catch (error) {
    console.warn('Error fetching Monarch vault adapter aliases:', error);
    return [];
  }
};

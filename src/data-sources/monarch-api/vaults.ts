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

export type VaultAdapterRelation = {
  adapterAddress: string;
  adapterType?: string;
  asset?: Address;
  chainId: SupportedNetworks;
  vaultAddress: string;
  vaultName: string;
};

export type MarketV2SupplyingVault = {
  adapterAddress: string;
  adapterType?: string;
  asset?: Address;
  chainId: SupportedNetworks;
  marketId: string;
  metadataDescription?: string;
  metadataImage?: string;
  supplyShares: string;
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
  earnedAssets?: bigint;
  earningsPeriodSeconds?: number;
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

type MonarchAdapterRelationRecord = MonarchAdapterRecord & {
  vault: {
    vaultAddress: string;
    asset: string;
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

type MonarchAdapterRelationsResponse = {
  data?: {
    Adapter?: MonarchAdapterRelationRecord[];
  };
};

type MonarchVaultAdapterRelationRecord = {
  vaultAddress: string;
  asset: string;
  chainId: number;
  name: string | null;
  symbol: string | null;
  adapters: MonarchVaultAdapter[];
};

type MonarchVaultAdapterRelationsResponse = {
  data?: {
    Vault?: MonarchVaultAdapterRelationRecord[];
  };
};

type MonarchMarketV2AdapterPositionRecord = {
  marketId: string;
  supplyShares: string;
  user: string;
};

type MonarchMarketV2AdapterPositionsResponse = {
  data?: {
    Position?: MonarchMarketV2AdapterPositionRecord[];
  };
};

const MONARCH_ADAPTER_RELATION_PAGE_SIZE = 1000;
const MONARCH_ADAPTER_RELATION_MAX_PAGES = 20;
const MONARCH_MARKET_V2_POSITIONS_PAGE_SIZE = 1000;
const MONARCH_MARKET_V2_POSITIONS_MAX_PAGES = 20;

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

const adapterRelationsQuery = `
  query MonarchVaultAdapterRelations($adapterTypes: [String!]!, $limit: Int!, $offset: Int!) {
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
        asset
        chainId
        name
        symbol
      }
    }
  }
`;

const activeVaultAdapterRelationsQuery = `
  query MonarchActiveVaultAdapterRelations($limit: Int!, $offset: Int!) {
    Vault(
      where: { adapters: { isActive: { _eq: true } } }
      order_by: [{ chainId: asc }, { vaultAddress: asc }]
      limit: $limit
      offset: $offset
    ) {
      vaultAddress
      asset
      chainId
      name
      symbol
      adapters {
        adapterAddress
        isActive
      }
    }
  }
`;

const marketV2AdapterPositionsQuery = `
  query MonarchMarketV2AdapterPositions(
    $chainId: Int!
    $marketIds: [String!]!
    $adapterAddresses: [String!]!
    $minShares: numeric!
    $limit: Int!
    $offset: Int!
  ) {
    Position(
      where: {
        chainId: { _eq: $chainId }
        marketId: { _in: $marketIds }
        user: { _in: $adapterAddresses }
        supplyShares: { _gt: $minShares }
      }
      order_by: [{ marketId: asc }, { user: asc }]
      limit: $limit
      offset: $offset
    ) {
      marketId
      user
      supplyShares
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

const transformAdapterRelationRecord = (adapter: MonarchAdapterRelationRecord): VaultAdapterRelation | null => {
  if (!isRecognizedMorphoMarketAdapterType(adapter.adapterType)) {
    return null;
  }

  const chainId = toSupportedNetwork(adapter.chainId);
  if (!chainId || (adapter.vault && adapter.vault.chainId !== adapter.chainId)) {
    return null;
  }

  const vaultAddress = normalizeAddress(adapter.vault?.vaultAddress ?? adapter.vaultAddress);
  if (!vaultAddress) {
    return null;
  }

  const vaultName =
    adapter.vault?.name?.trim() || adapter.vault?.symbol?.trim() || `Vault ${vaultAddress.slice(0, 6)}...${vaultAddress.slice(-4)}`;
  const asset = normalizeAddress(adapter.vault?.asset) as Address;

  return {
    adapterAddress: normalizeAddress(adapter.adapterAddress),
    adapterType: adapter.adapterType,
    asset: asset || undefined,
    chainId,
    vaultAddress,
    vaultName,
  };
};

const transformVaultAdapterRelationRecord = (vault: MonarchVaultAdapterRelationRecord): VaultAdapterRelation[] => {
  const chainId = toSupportedNetwork(vault.chainId);
  const vaultAddress = normalizeAddress(vault.vaultAddress);
  if (!chainId || !vaultAddress) {
    return [];
  }

  const vaultName =
    vault.name?.trim() || vault.symbol?.trim() || `Vault ${vaultAddress.slice(0, 6)}...${vaultAddress.slice(-4)}`;
  const asset = normalizeAddress(vault.asset) as Address;

  return vault.adapters
    .filter((adapter) => adapter.isActive)
    .map((adapter) => normalizeAddress(adapter.adapterAddress))
    .filter(Boolean)
    .map((adapterAddress) => ({
      adapterAddress,
      asset: asset || undefined,
      chainId,
      vaultAddress,
      vaultName,
    }));
};

export const fetchMonarchVaultAdapterRelations = async (): Promise<VaultAdapterRelation[]> => {
  try {
    const relationsByKey = new Map<string, VaultAdapterRelation>();
    const addRelation = (relation: VaultAdapterRelation) => {
      const key = `${relation.chainId}:${relation.adapterAddress}`;
      const existing = relationsByKey.get(key);
      if (!existing || (!existing.adapterType && relation.adapterType)) {
        relationsByKey.set(key, relation);
      }
    };

    for (let page = 0; page < MONARCH_ADAPTER_RELATION_MAX_PAGES; page++) {
      const response = await monarchGraphqlFetcher<MonarchAdapterRelationsResponse>(adapterRelationsQuery, {
        adapterTypes: MORPHO_MARKET_ADAPTER_TYPES,
        limit: MONARCH_ADAPTER_RELATION_PAGE_SIZE,
        offset: page * MONARCH_ADAPTER_RELATION_PAGE_SIZE,
      });

      const records = response.data?.Adapter ?? [];
      for (const record of records) {
        const relation = transformAdapterRelationRecord(record);
        if (!relation) {
          continue;
        }

        addRelation(relation);
      }

      if (records.length < MONARCH_ADAPTER_RELATION_PAGE_SIZE) {
        break;
      }
    }

    for (let page = 0; page < MONARCH_ADAPTER_RELATION_MAX_PAGES; page++) {
      const response = await monarchGraphqlFetcher<MonarchVaultAdapterRelationsResponse>(activeVaultAdapterRelationsQuery, {
        limit: MONARCH_ADAPTER_RELATION_PAGE_SIZE,
        offset: page * MONARCH_ADAPTER_RELATION_PAGE_SIZE,
      });

      const records = response.data?.Vault ?? [];
      for (const record of records) {
        for (const relation of transformVaultAdapterRelationRecord(record)) {
          addRelation(relation);
        }
      }

      if (records.length < MONARCH_ADAPTER_RELATION_PAGE_SIZE) {
        break;
      }
    }

    return Array.from(relationsByKey.values());
  } catch (error) {
    console.warn('Error fetching Monarch vault adapter relations:', error);
    return [];
  }
};

export const fetchMonarchMarketV2SupplyingVaults = async ({
  adapterRelations,
  chainId,
  marketIds,
}: {
  adapterRelations: VaultAdapterRelation[];
  chainId: SupportedNetworks;
  marketIds: string[];
}): Promise<MarketV2SupplyingVault[]> => {
  const normalizedMarketIds = Array.from(
    new Set(marketIds.map((marketId) => normalizeAddress(marketId)).filter(Boolean)),
  );
  if (normalizedMarketIds.length === 0 || adapterRelations.length === 0) {
    return [];
  }

  const relationsByAdapterAddress = new Map<string, VaultAdapterRelation>();
  for (const relation of adapterRelations) {
    if (relation.chainId !== chainId) {
      continue;
    }

    const adapterAddress = normalizeAddress(relation.adapterAddress);
    if (!adapterAddress) {
      continue;
    }

    relationsByAdapterAddress.set(adapterAddress, relation);
  }

  const adapterAddresses = Array.from(relationsByAdapterAddress.keys());
  if (adapterAddresses.length === 0) {
    return [];
  }

  const positions: MonarchMarketV2AdapterPositionRecord[] = [];
  for (let page = 0; page < MONARCH_MARKET_V2_POSITIONS_MAX_PAGES; page++) {
    const response = await monarchGraphqlFetcher<MonarchMarketV2AdapterPositionsResponse>(marketV2AdapterPositionsQuery, {
      adapterAddresses,
      chainId,
      limit: MONARCH_MARKET_V2_POSITIONS_PAGE_SIZE,
      marketIds: normalizedMarketIds,
      minShares: '0',
      offset: page * MONARCH_MARKET_V2_POSITIONS_PAGE_SIZE,
    });

    const records = response.data?.Position ?? [];
    positions.push(...records);

    if (records.length < MONARCH_MARKET_V2_POSITIONS_PAGE_SIZE) {
      break;
    }
  }

  const seen = new Set<string>();
  const vaults: MarketV2SupplyingVault[] = [];

  for (const position of positions) {
    const adapterAddress = normalizeAddress(position.user);
    const relation = relationsByAdapterAddress.get(adapterAddress);
    if (!relation) {
      continue;
    }

    const marketId = normalizeAddress(position.marketId);
    const key = `${chainId}:${marketId}:${relation.vaultAddress}:${adapterAddress}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    vaults.push({
      adapterAddress,
      adapterType: relation.adapterType,
      asset: relation.asset,
      chainId,
      marketId,
      supplyShares: position.supplyShares,
      vaultAddress: relation.vaultAddress,
      vaultName: relation.vaultName,
    });
  }

  return vaults;
};

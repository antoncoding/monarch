import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';
import { fetchMorphoVaultV2Metadata, type MorphoVaultV2Metadata } from '@/data-sources/morpho-api/vaults';
import {
  fetchMonarchMarketV2SupplyingVaults,
  type MarketV2SupplyingVault,
  type VaultAdapterRelation,
} from '@/data-sources/monarch-api/vaults';
import { getMarketIdentityKey } from '@/utils/market-identity';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { useVaultAdapterRelationsQuery } from './useVaultAdapterRelationsQuery';

const MARKET_V2_SUPPLYING_VAULTS_STALE_TIME_MS = 2 * 60 * 1000;
const MARKET_V2_SUPPLYING_VAULTS_GC_TIME_MS = 10 * 60 * 1000;
const EMPTY_LOOKUP = new Map<string, MarketV2SupplyingVault[]>();

type ChainMarketRequest = {
  chainId: SupportedNetworks;
  marketIds: string[];
};

type UseMarketV2SupplyingVaultsQueryOptions = {
  enabled?: boolean;
  markets: Market[];
  trustedVaults?: TrustedVault[];
};

const buildChainMarketRequests = (markets: Market[]): ChainMarketRequest[] => {
  const marketIdsByChain = new Map<SupportedNetworks, Set<string>>();

  for (const market of markets) {
    const chainId = market.morphoBlue.chain.id;
    const marketIds = marketIdsByChain.get(chainId) ?? new Set<string>();
    marketIds.add(market.uniqueKey.toLowerCase());
    marketIdsByChain.set(chainId, marketIds);
  }

  return Array.from(marketIdsByChain.entries())
    .map(([chainId, marketIds]) => ({
      chainId,
      marketIds: Array.from(marketIds).sort(),
    }))
    .sort((left, right) => left.chainId - right.chainId);
};

const buildAdapterRelationsFingerprint = (adapterRelations: VaultAdapterRelation[]): string => {
  const identity = adapterRelations
    .map((relation) => {
      return `${relation.chainId}:${relation.adapterAddress}:${relation.vaultAddress}:${relation.asset ?? ''}:${relation.adapterType ?? ''}:${relation.vaultName}`;
    })
    .sort()
    .join('|');
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) {
    hash = (hash * 31 + identity.charCodeAt(index)) % 4_294_967_291;
  }

  return `${adapterRelations.length}:${hash.toString(36)}`;
};

const buildLookup = (vaults: MarketV2SupplyingVault[]): Map<string, MarketV2SupplyingVault[]> => {
  if (vaults.length === 0) {
    return EMPTY_LOOKUP;
  }

  const lookup = new Map<string, MarketV2SupplyingVault[]>();

  for (const vault of vaults) {
    const key = getMarketIdentityKey(vault.chainId, vault.marketId);
    const existing = lookup.get(key) ?? [];
    existing.push(vault);
    lookup.set(key, existing);
  }

  for (const marketVaults of lookup.values()) {
    marketVaults.sort((left, right) => left.vaultName.localeCompare(right.vaultName));
  }

  return lookup;
};

const mergeMorphoV2Metadata = (vaults: MarketV2SupplyingVault[], morphoMetadata: MorphoVaultV2Metadata[]): MarketV2SupplyingVault[] => {
  if (vaults.length === 0 || morphoMetadata.length === 0) {
    return vaults;
  }

  const metadataByKey = new Map(morphoMetadata.map((vault) => [getVaultKey(vault.address, vault.chainId), vault]));

  return vaults.map((vault) => {
    const metadata = metadataByKey.get(getVaultKey(vault.vaultAddress, vault.chainId));
    if (!metadata) {
      return vault;
    }

    return {
      ...vault,
      asset: metadata.assetAddress as MarketV2SupplyingVault['asset'],
      metadataDescription: metadata.metadataDescription,
      metadataImage: metadata.metadataImage,
      vaultName: metadata.name || metadata.symbol || vault.vaultName,
    };
  });
};

export const useMarketV2SupplyingVaultsQuery = ({ enabled = true, markets, trustedVaults }: UseMarketV2SupplyingVaultsQueryOptions) => {
  const shouldLoadAdapterRelations = enabled && markets.length > 0 && (!trustedVaults || trustedVaults.length > 0);
  const adapterRelationsQuery = useVaultAdapterRelationsQuery({ enabled: shouldLoadAdapterRelations });
  const adapterRelations = adapterRelationsQuery.data ?? [];

  const trustedVaultKeys = useMemo(() => {
    if (!trustedVaults) {
      return null;
    }

    return new Set(trustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)));
  }, [trustedVaults]);
  const relevantAdapterRelations = useMemo(() => {
    if (!trustedVaultKeys) {
      return adapterRelations;
    }

    return adapterRelations.filter((relation) => trustedVaultKeys.has(getVaultKey(relation.vaultAddress, relation.chainId)));
  }, [adapterRelations, trustedVaultKeys]);
  const chainMarketRequests = useMemo(() => buildChainMarketRequests(markets), [markets]);
  const adapterRelationsFingerprint = useMemo(() => buildAdapterRelationsFingerprint(relevantAdapterRelations), [relevantAdapterRelations]);
  const requestKey = useMemo(
    () => chainMarketRequests.map((request) => `${request.chainId}:${request.marketIds.join(',')}`).join('|'),
    [chainMarketRequests],
  );

  const query = useQuery<MarketV2SupplyingVault[], Error>({
    queryKey: ['monarch-market-v2-supplying-vaults', requestKey, adapterRelationsFingerprint],
    queryFn: async () => {
      const results = await Promise.all(
        chainMarketRequests.map((request) =>
          fetchMonarchMarketV2SupplyingVaults({
            adapterRelations: relevantAdapterRelations,
            chainId: request.chainId,
            marketIds: request.marketIds,
          }),
        ),
      );

      const vaults = results.flat();
      if (vaults.length === 0) {
        return vaults;
      }

      const morphoMetadata = await fetchMorphoVaultV2Metadata(
        vaults.map((vault) => ({
          address: vault.vaultAddress,
          chainId: vault.chainId,
        })),
      );

      return mergeMorphoV2Metadata(vaults, morphoMetadata);
    },
    enabled: shouldLoadAdapterRelations && relevantAdapterRelations.length > 0 && chainMarketRequests.length > 0,
    staleTime: MARKET_V2_SUPPLYING_VAULTS_STALE_TIME_MS,
    gcTime: MARKET_V2_SUPPLYING_VAULTS_GC_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const lookup = useMemo(() => buildLookup(query.data ?? []), [query.data]);

  return {
    ...query,
    lookup,
  };
};

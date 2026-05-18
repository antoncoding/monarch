import { useMemo } from 'react';
import { supportsMorphoApi } from '@/config/dataSources';
import { useMorphoWhitelistStatusQuery } from '@/hooks/queries/useMorphoWhitelistStatusQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useAllOracleMetadata } from '@/hooks/useOracleMetadata';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';

export type MarketFilterGuardId = 'unknown-tokens' | 'unknown-oracles' | 'unwhitelisted-markets';
export type MarketFilterDependencyReadiness = 'ready' | 'loading' | 'partial' | 'stale' | 'unavailable';

export type MarketFilterGuardStatus = {
  id: MarketFilterGuardId;
  active: boolean;
  readiness: MarketFilterDependencyReadiness;
  statusLabel: string;
  impact: string;
};

const MORPHO_WHITELIST_NETWORKS = ALL_SUPPORTED_NETWORKS.filter((network) => supportsMorphoApi(network));
const ALL_NETWORK_SET = new Set<SupportedNetworks>(ALL_SUPPORTED_NETWORKS);

const getNetworkReadiness = (
  availableChainIds: Set<number>,
  expectedChainIds: readonly SupportedNetworks[],
  isLoading: boolean,
  isError: boolean,
): MarketFilterDependencyReadiness => {
  const hasAllExpectedChainIds = expectedChainIds.every((chainId) => availableChainIds.has(chainId));

  if (hasAllExpectedChainIds) {
    return isError ? 'stale' : 'ready';
  }

  if (isLoading) {
    return 'loading';
  }

  if (availableChainIds.size > 0) {
    return 'partial';
  }

  return 'unavailable';
};

const getStatusLabel = (readiness: MarketFilterDependencyReadiness): string => {
  if (readiness === 'ready') return 'Applied';
  if (readiness === 'loading') return 'Checking';
  if (readiness === 'partial') return 'Incomplete';
  if (readiness === 'stale') return 'Refresh failed';
  return 'Fetch failed';
};

const isAffected = (guard: MarketFilterGuardStatus): boolean =>
  guard.active && guard.readiness !== 'ready' && guard.readiness !== 'loading';

export const useMarketFilterDependencyStatus = () => {
  const { includeUnknownTokens, showUnknownOracle } = useMarketPreferences();
  const { showUnwhitelistedMarkets } = useAppSettings();
  const tokenQuery = useTokensQuery();
  const whitelistQuery = useMorphoWhitelistStatusQuery();
  const oracleQuery = useAllOracleMetadata({ enabled: !showUnknownOracle, defer: true });

  const oracleMetadataMap = oracleQuery.data;
  const oracleChainIds = useMemo(() => {
    return new Set(
      Object.values(oracleMetadataMap ?? {})
        .map((oracle) => oracle.chainId)
        .filter((chainId): chainId is SupportedNetworks => ALL_NETWORK_SET.has(chainId as SupportedNetworks)),
    );
  }, [oracleMetadataMap]);

  const tokenReadiness: MarketFilterDependencyReadiness = tokenQuery.isLoading
    ? 'loading'
    : tokenQuery.isError
      ? tokenQuery.hasFetchedTokens
        ? 'stale'
        : 'unavailable'
      : 'ready';
  const whitelistReadiness = getNetworkReadiness(
    whitelistQuery.availableWhitelistChainIds,
    MORPHO_WHITELIST_NETWORKS,
    whitelistQuery.isLoading || (whitelistQuery.isFetching && whitelistQuery.availableWhitelistChainIds.size === 0),
    whitelistQuery.isError,
  );
  const oracleReadiness = getNetworkReadiness(oracleChainIds, ALL_SUPPORTED_NETWORKS, oracleQuery.isLoading, oracleQuery.isError);

  const guardStatuses = useMemo<MarketFilterGuardStatus[]>(
    () => [
      {
        id: 'unknown-tokens',
        active: !includeUnknownTokens,
        readiness: tokenReadiness,
        statusLabel: getStatusLabel(tokenReadiness),
        impact:
          tokenReadiness === 'ready'
            ? 'Hide Unknown Tokens is using the current token list.'
            : tokenReadiness === 'loading'
              ? 'Token metadata is still loading. Markets are shown until Hide Unknown Tokens can be checked.'
              : tokenReadiness === 'stale'
                ? 'Token metadata refresh failed. Using the last loaded token list, so newly recognized tokens may still look unknown.'
                : 'Token metadata fetch failed. Hide Unknown Tokens is temporarily relaxed, so markets with unrecognized tokens may appear.',
      },
      {
        id: 'unknown-oracles',
        active: !showUnknownOracle,
        readiness: oracleReadiness,
        statusLabel: getStatusLabel(oracleReadiness),
        impact:
          oracleReadiness === 'ready'
            ? 'Hide Unknown Oracles is using the current oracle classifications.'
            : oracleReadiness === 'loading'
              ? 'Oracle metadata is still loading. Markets are shown until Hide Unknown Oracles can be checked.'
              : oracleReadiness === 'stale'
                ? 'Oracle metadata refresh failed. Using saved oracle classifications, so newly unknown or custom oracle feeds may still appear.'
                : oracleReadiness === 'partial'
                  ? 'Oracle metadata is missing for some chains. Hide Unknown Oracles is relaxed on those chains, so markets with unknown or custom oracle feeds may appear.'
                  : 'Oracle metadata fetch failed. Hide Unknown Oracles is temporarily relaxed, so markets with unknown or custom oracle feeds may appear.',
      },
      {
        id: 'unwhitelisted-markets',
        active: !showUnwhitelistedMarkets,
        readiness: whitelistReadiness,
        statusLabel: getStatusLabel(whitelistReadiness),
        impact:
          whitelistReadiness === 'ready'
            ? 'Hide Unwhitelisted Markets is using the current Morpho whitelist.'
            : whitelistReadiness === 'loading'
              ? 'Morpho whitelist is still loading. Markets are shown until Hide Unwhitelisted Markets can be checked.'
              : whitelistReadiness === 'stale'
                ? 'Morpho whitelist refresh failed. Using saved whitelist and supplying-vault data, so newly whitelisted or unwhitelisted markets may be out of date.'
                : whitelistReadiness === 'partial'
                  ? 'Morpho whitelist is missing for some chains. The final market list may include markets that are not whitelisted on those chains, and supplying-vault data may be incomplete.'
                  : 'Morpho whitelist fetch failed. The final market list may include markets that are not whitelisted, and supplying-vault data may be missing.',
      },
    ],
    [includeUnknownTokens, oracleReadiness, showUnknownOracle, showUnwhitelistedMarkets, tokenReadiness, whitelistReadiness],
  );

  const affectedGuards = useMemo(() => guardStatuses.filter(isAffected), [guardStatuses]);

  return {
    guardStatuses,
    affectedGuards,
    hasAffectedGuards: affectedGuards.length > 0,
    canEvaluateUnknownTokenGuard: tokenReadiness === 'ready' || tokenReadiness === 'stale',
    oracleMetadataMap,
    oracleChainIds,
    whitelistChainIds: whitelistQuery.availableWhitelistChainIds,
  };
};

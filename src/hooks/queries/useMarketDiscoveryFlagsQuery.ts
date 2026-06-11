import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MARKET_DISCOVERY_CATEGORIES, getMarketDiscoveryKey, type MarketDiscoveryCategory } from '@/features/markets/market-discovery';
import { useDeferredQueryEnable } from '@/hooks/useDeferredQueryEnable';
import { getMonarchApiAuthHeaders } from '@/utils/monarchApiAuth';
import { DATA_API_BASE_URL } from '@/utils/urls';

export type MarketDiscoveryFlagReason =
  | 'recently_created'
  | 'newly_active'
  | 'strong_recent_flow'
  | 'morpho_vault_signal'
  | 'monarch_user_flow';

export type MarketDiscoveryFlag = {
  chainId: number;
  marketUniqueKey: string;
  reasons: MarketDiscoveryFlagReason[];
  summary: string;
};

export type MarketDiscoveryFlagsResponse = {
  updatedAt: string | null;
  flags: Record<MarketDiscoveryCategory, MarketDiscoveryFlag[]>;
};

type MarketDiscoveryFlagsParams = {
  enabled?: boolean;
  defer?: boolean;
};

type MarketDiscoveryFlagMaps = {
  flagsByMarket: Map<string, MarketDiscoveryFlag[]>;
  categoriesByMarket: Map<string, Set<MarketDiscoveryCategory>>;
};

const MARKET_DISCOVERY_FLAGS_REFRESH_MS = 15 * 60 * 1000;
const MARKET_DISCOVERY_FLAGS_QUERY_SCHEMA_VERSION = 1;

const fetchMarketDiscoveryFlags = async (): Promise<MarketDiscoveryFlagsResponse> => {
  if (!DATA_API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_DATA_API_BASE_URL is required.');
  }

  const response = await fetch(`${DATA_API_BASE_URL}/v1/markets/flags`, {
    headers: getMonarchApiAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch market discovery flags');
  }

  return response.json();
};

export const useMarketDiscoveryFlagsQuery = (params: MarketDiscoveryFlagsParams = {}) => {
  const { enabled = true, defer = false } = params;
  const queryEnabled = useDeferredQueryEnable(enabled, defer, 2000);

  return useQuery({
    queryKey: ['market-discovery-flags', MARKET_DISCOVERY_FLAGS_QUERY_SCHEMA_VERSION],
    queryFn: fetchMarketDiscoveryFlags,
    staleTime: MARKET_DISCOVERY_FLAGS_REFRESH_MS,
    refetchInterval: MARKET_DISCOVERY_FLAGS_REFRESH_MS,
    refetchOnWindowFocus: false,
    enabled: queryEnabled,
  });
};

export const useMarketDiscoveryFlagsMap = (params: MarketDiscoveryFlagsParams = {}) => {
  const { data, isLoading, ...rest } = useMarketDiscoveryFlagsQuery(params);

  const maps = useMemo<MarketDiscoveryFlagMaps>(() => {
    const flagsByMarket = new Map<string, MarketDiscoveryFlag[]>();
    const categoriesByMarket = new Map<string, Set<MarketDiscoveryCategory>>();

    if (!data?.flags) {
      return { flagsByMarket, categoriesByMarket };
    }

    for (const category of MARKET_DISCOVERY_CATEGORIES) {
      const flags = data.flags[category] ?? [];
      for (const flag of flags) {
        const key = getMarketDiscoveryKey(flag.chainId, flag.marketUniqueKey);
        const existingFlags = flagsByMarket.get(key);
        if (existingFlags) {
          existingFlags.push(flag);
        } else {
          flagsByMarket.set(key, [flag]);
        }

        const existingCategories = categoriesByMarket.get(key);
        if (existingCategories) {
          existingCategories.add(category);
        } else {
          categoriesByMarket.set(key, new Set([category]));
        }
      }
    }

    return { flagsByMarket, categoriesByMarket };
  }, [data?.flags]);

  return {
    ...maps,
    data,
    isLoading,
    ...rest,
  };
};

export const useMarketDiscoveryFlagKeys = ({
  categories,
  enabled = true,
  defer = false,
}: MarketDiscoveryFlagsParams & { categories: MarketDiscoveryCategory[] }) => {
  const { categoriesByMarket } = useMarketDiscoveryFlagsMap({
    enabled: enabled && categories.length > 0,
    defer,
  });

  return useMemo(() => {
    const keys = new Set<string>();
    if (categories.length === 0) return keys;

    const selectedCategories = new Set(categories);
    for (const [key, marketCategories] of categoriesByMarket) {
      for (const category of marketCategories) {
        if (selectedCategories.has(category)) {
          keys.add(key);
          break;
        }
      }
    }

    return keys;
  }, [categories, categoriesByMarket]);
};

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TokenPriceInput } from '@/data-sources/morpho-api/prices';
import { fetchResolvedTokenPrices, dedupeTokenPriceInputs } from '@/data-sources/shared/token-prices';
import type { MarketUsdPriceSource } from '@/utils/types';

// Query keys for token prices
export const tokenPriceKeys = {
  all: ['tokenPrices'] as const,
  tokens: (tokens: TokenPriceInput[]) => {
    // Create a stable, sorted key from tokens
    const sortedTokens = [...tokens]
      .map((t) => `${t.address.toLowerCase()}-${t.chainId}`)
      .sort()
      .join(',');
    return [...tokenPriceKeys.all, sortedTokens] as const;
  },
};

type UseTokenPricesReturn = {
  prices: Map<string, number>;
  sources: Map<string, MarketUsdPriceSource>;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook to fetch and cache token prices from Morpho API
 * @param tokens - Array of token addresses and chain IDs to fetch prices for
 * @returns Object containing prices map, loading state, and error
 */
export const useTokenPrices = (tokens: TokenPriceInput[]): UseTokenPricesReturn => {
  // Memoize the token list to prevent unnecessary refetches
  const stableTokens = useMemo(() => {
    return dedupeTokenPriceInputs(tokens);
  }, [tokens]);

  const {
    data: resolvedTokenPrices,
    isLoading,
    error,
  } = useQuery<{ prices: Map<string, number>; sources: Map<string, MarketUsdPriceSource> }, Error>({
    queryKey: tokenPriceKeys.tokens(stableTokens),
    queryFn: async () => {
      return fetchResolvedTokenPrices(stableTokens);
    },
    enabled: stableTokens.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    prices: resolvedTokenPrices?.prices ?? new Map<string, number>(),
    sources: resolvedTokenPrices?.sources ?? new Map<string, MarketUsdPriceSource>(),
    isLoading,
    error: error ?? null,
  };
};

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTokenPrices, type TokenPriceInput } from '@/data-sources/morpho-api/prices';

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
    // Deduplicate tokens based on address-chainId combination
    const uniqueTokens = new Map<string, TokenPriceInput>();
    tokens.forEach((token) => {
      const key = `${token.address.toLowerCase()}-${token.chainId}`;
      if (!uniqueTokens.has(key)) {
        uniqueTokens.set(key, {
          address: token.address.toLowerCase(),
          chainId: token.chainId,
        });
      }
    });
    return Array.from(uniqueTokens.values());
  }, [tokens]);

  const {
    data: prices,
    isLoading,
    error,
  } = useQuery<Map<string, number>, Error>({
    queryKey: tokenPriceKeys.tokens(stableTokens),
    queryFn: async () => {
      return fetchTokenPrices(stableTokens);
    },
    enabled: stableTokens.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    prices: prices ?? new Map(),
    isLoading,
    error: error ?? null,
  };
};

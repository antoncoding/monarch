import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTokenPrices, type TokenPriceInput } from '@/data-sources/morpho-api/prices';
import { getTokenPriceKey } from '@/data-sources/morpho-api/prices';
import { findToken, TokenPeg, supportedTokens } from '@/utils/tokens';
import { fetchMajorPrices, type MajorPrices } from '@/utils/majorPrices';

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
const getPegCacheKey = (peg: TokenPeg, chainId: number) => `${peg}-${chainId}`;

const isFinitePositive = (value: number | undefined): value is number => {
  return value !== undefined && Number.isFinite(value) && value > 0;
};

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

  // If we need ETH/BTC peg fallbacks, add reference tokens for those pegs on the same chains.
  const tokensWithPegRefs = useMemo(() => {
    if (stableTokens.length === 0) return stableTokens;

    const neededPegs = new Set<TokenPeg>();
    const chainIds = new Set<number>();

    stableTokens.forEach((token) => {
      chainIds.add(token.chainId);
      const meta = findToken(token.address, token.chainId);
      if (meta?.peg === TokenPeg.ETH || meta?.peg === TokenPeg.BTC) {
        neededPegs.add(meta.peg);
      }
    });

    if (neededPegs.size === 0) return stableTokens;

    const uniqueTokens = new Map<string, TokenPriceInput>();
    stableTokens.forEach((token) => {
      uniqueTokens.set(getTokenPriceKey(token.address, token.chainId), token);
    });

    supportedTokens.forEach((token) => {
      if (!token.peg || !neededPegs.has(token.peg)) return;
      token.networks.forEach((network) => {
        if (!chainIds.has(network.chain.id)) return;
        const key = getTokenPriceKey(network.address, network.chain.id);
        if (!uniqueTokens.has(key)) {
          uniqueTokens.set(key, { address: network.address.toLowerCase(), chainId: network.chain.id });
        }
      });
    });

    return Array.from(uniqueTokens.values());
  }, [stableTokens]);

  const {
    data: prices,
    isLoading,
    error,
  } = useQuery<Map<string, number>, Error>({
    queryKey: tokenPriceKeys.tokens(tokensWithPegRefs),
    queryFn: async () => {
      return fetchTokenPrices(tokensWithPegRefs);
    },
    enabled: tokensWithPegRefs.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const needsMajorPrices = useMemo(() => {
    return stableTokens.some((token) => {
      const meta = findToken(token.address, token.chainId);
      return meta?.peg === TokenPeg.ETH || meta?.peg === TokenPeg.BTC;
    });
  }, [stableTokens]);

  const { data: majorPrices } = useQuery<MajorPrices, Error>({
    queryKey: ['majorPrices'],
    queryFn: fetchMajorPrices,
    enabled: needsMajorPrices,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });

  const pricesWithFallback = useMemo(() => {
    const basePrices = prices ?? new Map<string, number>();
    const resolvedPrices = new Map(basePrices);

    // Cache peg reference prices by chain
    const pegPricesByChain = new Map<string, number>();
    let globalEthPrice: number | undefined = majorPrices?.[TokenPeg.ETH];
    let globalBtcPrice: number | undefined = majorPrices?.[TokenPeg.BTC];

    tokensWithPegRefs.forEach((token) => {
      const meta = findToken(token.address, token.chainId);
      if (!meta?.peg || meta.peg === TokenPeg.USD) return;
      const key = getTokenPriceKey(token.address, token.chainId);
      const price = basePrices.get(key);
      if (!isFinitePositive(price)) return;

      const pegKey = getPegCacheKey(meta.peg, token.chainId);
      if (!pegPricesByChain.has(pegKey)) {
        pegPricesByChain.set(pegKey, price);
      }

      if (meta.peg === TokenPeg.ETH && !globalEthPrice) globalEthPrice = price;
      if (meta.peg === TokenPeg.BTC && !globalBtcPrice) globalBtcPrice = price;
    });

    const resolvePegPrice = (peg: TokenPeg, chainId: number): number | undefined => {
      if (peg === TokenPeg.USD) return 1;
      const chainKey = getPegCacheKey(peg, chainId);
      const chainPrice = pegPricesByChain.get(chainKey);
      if (isFinitePositive(chainPrice)) return chainPrice;
      if (peg === TokenPeg.ETH) return globalEthPrice;
      if (peg === TokenPeg.BTC) return globalBtcPrice;
      return undefined;
    };

    stableTokens.forEach((token) => {
      const key = getTokenPriceKey(token.address, token.chainId);
      if (resolvedPrices.has(key)) return;

      const meta = findToken(token.address, token.chainId);
      if (!meta?.peg) return;

      const fallbackPrice = resolvePegPrice(meta.peg, token.chainId);
      if (isFinitePositive(fallbackPrice)) {
        resolvedPrices.set(key, fallbackPrice);
      }
    });

    return resolvedPrices;
  }, [prices, stableTokens, tokensWithPegRefs, majorPrices]);

  return {
    prices: pricesWithFallback,
    isLoading,
    error: error ?? null,
  };
};

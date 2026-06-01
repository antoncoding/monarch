import { useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTokenPrices, getTokenPriceKey, type TokenPriceInput } from '@/data-sources/morpho-api/prices';
import { fetchMajorPrices, type MajorPrices } from '@/utils/majorPrices';
import { findToken, supportedTokens, TokenPeg } from '@/utils/tokens';

const TOKEN_PRICE_STALE_TIME = 5 * 60 * 1000;
const TOKEN_PRICE_GC_TIME = 10 * 60 * 1000;

type TokenPriceCacheEntry = {
  price: number | null;
  direct: boolean;
};

// Query keys for token prices. Batch keys preserve network efficiency; token
// keys make overlapping consumers share cached prices by chain + address.
export const tokenPriceKeys = {
  all: ['tokenPrices'] as const,
  token: (token: TokenPriceInput) => [...tokenPriceKeys.all, 'token', token.chainId, token.address.toLowerCase()] as const,
  batch: (tokens: TokenPriceInput[]) => {
    const sortedTokens = [...tokens]
      .map((token) => getTokenPriceKey(token.address, token.chainId))
      .sort()
      .join(',');
    return [...tokenPriceKeys.all, 'batch', sortedTokens] as const;
  },
  tokens: (tokens: TokenPriceInput[]) => tokenPriceKeys.batch(tokens),
};

type UseTokenPricesReturn = {
  prices: Map<string, number>;
  directPriceKeys: Set<string>;
  isLoading: boolean;
  error: Error | null;
};

type UseTokenPricesOptions = {
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
};

const getPegCacheKey = (peg: TokenPeg, chainId: number) => `${peg}-${chainId}`;

const isFinitePositive = (value: number | null | undefined): value is number => {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
};

const toCacheEntry = (price: number | undefined): TokenPriceCacheEntry => {
  return isFinitePositive(price) ? { price, direct: true } : { price: null, direct: false };
};

const normalizeTokens = (tokens: TokenPriceInput[]): TokenPriceInput[] => {
  const uniqueTokens = new Map<string, TokenPriceInput>();

  tokens.forEach((token) => {
    const normalizedToken = {
      address: token.address.toLowerCase(),
      chainId: token.chainId,
    };
    const key = getTokenPriceKey(normalizedToken.address, normalizedToken.chainId);

    if (!uniqueTokens.has(key)) {
      uniqueTokens.set(key, normalizedToken);
    }
  });

  return Array.from(uniqueTokens.values());
};

/**
 * Hook to fetch and cache token prices from Morpho API.
 *
 * Prices are fetched in batches for network efficiency, then stored under
 * per-token query keys so a page asking for a subset can reuse data fetched by
 * a broader market view, and vice versa.
 */
export const useTokenPrices = (tokens: TokenPriceInput[], options?: UseTokenPricesOptions): UseTokenPricesReturn => {
  const queryClient = useQueryClient();
  const stableTokens = useMemo(() => normalizeTokens(tokens), [tokens]);

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

    chainIds.forEach((chainId) => {
      neededPegs.forEach((peg) => {
        const referenceToken = supportedTokens.find((token) => {
          return token.peg === peg && token.networks.some((_network) => _network.chain.id === chainId);
        });
        if (!referenceToken) return;
        const network = referenceToken.networks.find((tokenNetwork) => tokenNetwork.chain.id === chainId);
        if (!network) return;

        const key = getTokenPriceKey(network.address, chainId);
        if (!uniqueTokens.has(key)) {
          uniqueTokens.set(key, { address: network.address.toLowerCase(), chainId });
        }
      });
    });

    return Array.from(uniqueTokens.values());
  }, [stableTokens]);

  const tokenCacheQueries = useQueries({
    queries: tokensWithPegRefs.map((token) => ({
      queryKey: tokenPriceKeys.token(token),
      queryFn: async () => {
        const prices = await fetchTokenPrices([token]);
        return toCacheEntry(prices.get(getTokenPriceKey(token.address, token.chainId)));
      },
      enabled: false,
      staleTime: TOKEN_PRICE_STALE_TIME,
      gcTime: TOKEN_PRICE_GC_TIME,
    })),
  });

  const tokensToFetch = useMemo(() => {
    return tokensWithPegRefs.filter((_token, index) => {
      const query = tokenCacheQueries[index];
      return !query?.data || query.isStale;
    });
  }, [tokenCacheQueries, tokensWithPegRefs]);

  const batchPriceQuery = useQuery<Map<string, TokenPriceCacheEntry>, Error>({
    queryKey: tokenPriceKeys.batch(tokensToFetch),
    queryFn: async () => {
      const prices = await fetchTokenPrices(tokensToFetch);
      const entries = new Map<string, TokenPriceCacheEntry>();

      tokensToFetch.forEach((token) => {
        const key = getTokenPriceKey(token.address, token.chainId);
        const entry = toCacheEntry(prices.get(key));

        entries.set(key, entry);
        queryClient.setQueryData(tokenPriceKeys.token(token), entry);
      });

      return entries;
    },
    enabled: tokensToFetch.length > 0,
    staleTime: TOKEN_PRICE_STALE_TIME,
    gcTime: TOKEN_PRICE_GC_TIME,
    ...(options?.refetchOnWindowFocus === undefined ? {} : { refetchOnWindowFocus: options.refetchOnWindowFocus }),
    ...(options?.refetchOnReconnect === undefined ? {} : { refetchOnReconnect: options.refetchOnReconnect }),
  });

  const priceEntries = useMemo(() => {
    const entries = new Map<string, TokenPriceCacheEntry>();

    tokensWithPegRefs.forEach((token, index) => {
      const entry = tokenCacheQueries[index]?.data;
      if (!entry) return;
      entries.set(getTokenPriceKey(token.address, token.chainId), entry);
    });

    batchPriceQuery.data?.forEach((entry, key) => {
      entries.set(key, entry);
    });

    return entries;
  }, [batchPriceQuery.data, tokenCacheQueries, tokensWithPegRefs]);

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
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    ...(options?.refetchOnWindowFocus === undefined ? {} : { refetchOnWindowFocus: options.refetchOnWindowFocus }),
    ...(options?.refetchOnReconnect === undefined ? {} : { refetchOnReconnect: options.refetchOnReconnect }),
  });

  const basePrices = useMemo(() => {
    const prices = new Map<string, number>();

    priceEntries.forEach((entry, key) => {
      if (isFinitePositive(entry.price)) {
        prices.set(key, entry.price);
      }
    });

    return prices;
  }, [priceEntries]);

  const pricesWithFallback = useMemo(() => {
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
  }, [basePrices, stableTokens, tokensWithPegRefs, majorPrices]);

  const directPriceKeys = useMemo(() => {
    const keys = new Set<string>();

    priceEntries.forEach((entry, key) => {
      if (entry.direct && isFinitePositive(entry.price)) {
        keys.add(key);
      }
    });

    return keys;
  }, [priceEntries]);

  const hasUncachedTokens = tokenCacheQueries.some((query) => !query.data);

  return {
    prices: pricesWithFallback,
    directPriceKeys,
    isLoading: tokensWithPegRefs.length > 0 && hasUncachedTokens && batchPriceQuery.isLoading,
    error: batchPriceQuery.error ?? null,
  };
};

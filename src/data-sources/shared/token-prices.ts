import { fetchTokenPrices, getTokenPriceKey, type TokenPriceInput } from '@/data-sources/morpho-api/prices';
import { fetchMajorPrices, type MajorPrices } from '@/utils/majorPrices';
import { findToken, TokenPeg, supportedTokens } from '@/utils/tokens';
import type { MarketUsdPriceSource } from '@/utils/types';

type ResolvedTokenPrices = {
  prices: Map<string, number>;
  sources: Map<string, MarketUsdPriceSource>;
};

const getPegCacheKey = (peg: TokenPeg, chainId: number) => `${peg}-${chainId}`;

const isFinitePositive = (value: number | undefined): value is number => {
  return value !== undefined && Number.isFinite(value) && value > 0;
};

export const dedupeTokenPriceInputs = (tokens: TokenPriceInput[]): TokenPriceInput[] => {
  const uniqueTokens = new Map<string, TokenPriceInput>();

  for (const token of tokens) {
    const key = getTokenPriceKey(token.address, token.chainId);
    if (!uniqueTokens.has(key)) {
      uniqueTokens.set(key, {
        address: token.address.toLowerCase(),
        chainId: token.chainId,
      });
    }
  }

  return Array.from(uniqueTokens.values());
};

export const augmentTokenPriceInputsWithPegRefs = (tokens: TokenPriceInput[]): TokenPriceInput[] => {
  if (tokens.length === 0) {
    return tokens;
  }

  const neededPegs = new Set<TokenPeg>();
  const chainIds = new Set<number>();

  for (const token of tokens) {
    chainIds.add(token.chainId);
    const meta = findToken(token.address, token.chainId);

    if (meta?.peg === TokenPeg.ETH || meta?.peg === TokenPeg.BTC) {
      neededPegs.add(meta.peg);
    }
  }

  if (neededPegs.size === 0) {
    return tokens;
  }

  const uniqueTokens = new Map<string, TokenPriceInput>();
  for (const token of tokens) {
    uniqueTokens.set(getTokenPriceKey(token.address, token.chainId), token);
  }

  for (const chainId of chainIds) {
    for (const peg of neededPegs) {
      const referenceToken = supportedTokens.find((token) => {
        return token.peg === peg && token.networks.some((network) => network.chain.id === chainId);
      });
      const network = referenceToken?.networks.find((candidate) => candidate.chain.id === chainId);

      if (!network) {
        continue;
      }

      const key = getTokenPriceKey(network.address, chainId);
      if (!uniqueTokens.has(key)) {
        uniqueTokens.set(key, {
          address: network.address.toLowerCase(),
          chainId,
        });
      }
    }
  }

  return Array.from(uniqueTokens.values());
};

const needsMajorPrices = (tokens: TokenPriceInput[]): boolean => {
  return tokens.some((token) => {
    const meta = findToken(token.address, token.chainId);
    return meta?.peg === TokenPeg.ETH || meta?.peg === TokenPeg.BTC;
  });
};

export const resolveTokenPricesWithFallback = ({
  directPrices,
  majorPrices,
  stableTokens,
  tokensWithPegRefs,
}: {
  directPrices: Map<string, number>;
  majorPrices?: MajorPrices;
  stableTokens: TokenPriceInput[];
  tokensWithPegRefs: TokenPriceInput[];
}): Map<string, number> => {
  const resolvedPrices = new Map(directPrices);
  const pegPricesByChain = new Map<string, number>();
  let globalEthPrice: number | undefined = majorPrices?.[TokenPeg.ETH];
  let globalBtcPrice: number | undefined = majorPrices?.[TokenPeg.BTC];

  for (const token of tokensWithPegRefs) {
    const meta = findToken(token.address, token.chainId);
    if (!meta?.peg || meta.peg === TokenPeg.USD) {
      continue;
    }

    const key = getTokenPriceKey(token.address, token.chainId);
    const price = directPrices.get(key);
    if (!isFinitePositive(price)) {
      continue;
    }

    const pegKey = getPegCacheKey(meta.peg, token.chainId);
    if (!pegPricesByChain.has(pegKey)) {
      pegPricesByChain.set(pegKey, price);
    }

    if (meta.peg === TokenPeg.ETH && !globalEthPrice) {
      globalEthPrice = price;
    }

    if (meta.peg === TokenPeg.BTC && !globalBtcPrice) {
      globalBtcPrice = price;
    }
  }

  const resolvePegPrice = (peg: TokenPeg, chainId: number): number | undefined => {
    if (peg === TokenPeg.USD) {
      return 1;
    }

    const chainPrice = pegPricesByChain.get(getPegCacheKey(peg, chainId));
    if (isFinitePositive(chainPrice)) {
      return chainPrice;
    }

    if (peg === TokenPeg.ETH) {
      return globalEthPrice;
    }

    if (peg === TokenPeg.BTC) {
      return globalBtcPrice;
    }

    return undefined;
  };

  for (const token of stableTokens) {
    const key = getTokenPriceKey(token.address, token.chainId);
    if (resolvedPrices.has(key)) {
      continue;
    }

    const meta = findToken(token.address, token.chainId);
    if (!meta?.peg) {
      continue;
    }

    const fallbackPrice = resolvePegPrice(meta.peg, token.chainId);
    if (isFinitePositive(fallbackPrice)) {
      resolvedPrices.set(key, fallbackPrice);
    }
  }

  return resolvedPrices;
};

export const resolveTokenPriceSources = ({
  directPrices,
  resolvedPrices,
  stableTokens,
}: {
  directPrices: Map<string, number>;
  resolvedPrices: Map<string, number>;
  stableTokens: TokenPriceInput[];
}): Map<string, MarketUsdPriceSource> => {
  const sources = new Map<string, MarketUsdPriceSource>();

  for (const token of stableTokens) {
    const key = getTokenPriceKey(token.address, token.chainId);
    const directPrice = directPrices.get(key);

    if (isFinitePositive(directPrice)) {
      sources.set(key, 'direct');
      continue;
    }

    const meta = findToken(token.address, token.chainId);
    if (!meta?.peg) {
      continue;
    }

    const fallbackPrice = resolvedPrices.get(key);
    if (isFinitePositive(fallbackPrice)) {
      sources.set(key, 'peg');
    }
  }

  return sources;
};

export const fetchResolvedTokenPrices = async (tokens: TokenPriceInput[]): Promise<ResolvedTokenPrices> => {
  const stableTokens = dedupeTokenPriceInputs(tokens);

  if (stableTokens.length === 0) {
    return {
      prices: new Map<string, number>(),
      sources: new Map<string, MarketUsdPriceSource>(),
    };
  }

  const tokensWithPegRefs = augmentTokenPriceInputsWithPegRefs(stableTokens);
  const shouldFetchMajorPrices = needsMajorPrices(stableTokens);

  const [directPrices, majorPrices] = await Promise.all([
    fetchTokenPrices(tokensWithPegRefs),
    shouldFetchMajorPrices ? fetchMajorPrices().catch(() => ({})) : Promise.resolve({} as MajorPrices),
  ]);

  const resolvedPrices = resolveTokenPricesWithFallback({
    directPrices,
    majorPrices,
    stableTokens,
    tokensWithPegRefs,
  });
  const sources = resolveTokenPriceSources({
    directPrices,
    resolvedPrices,
    stableTokens,
  });

  return {
    prices: resolvedPrices,
    sources,
  };
};

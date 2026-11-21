import { erc20Abi, parseAbi, type Address, type Hex } from 'viem';
import { z } from 'zod';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from './networks';
import { readPersistedApiResponses, writePersistedApiResponses } from './persistedApiResponseCache';
import { getClient } from './rpc';
import { findToken, infoToKey, type ERC20Token } from './tokens';
import type { TokenInfo } from './types';
import { getMonarchApiAuthHeaders } from './monarchApiAuth';
import { DATA_API_BASE_URL } from './urls';

export type TokenAddressInput = {
  address: string;
  chainId: SupportedNetworks;
};

export type ResolvedTokenInfo = {
  token: TokenInfo;
  isRecognized: boolean;
};

export type OnchainTokenMetadata = {
  decimals?: number;
  symbol?: string;
};

export type SerializedResolvedTokenInfos = Record<string, ResolvedTokenInfo>;

type ResolveTokenInfosOptions = {
  resolveUnknownTokens?: boolean;
  trustedTokens?: ERC20Token[];
};

const TOKEN_METADATA_BATCH_SIZE = 200;
const TOKEN_METADATA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const erc20SymbolBytes32Abi = parseAbi(['function symbol() view returns (bytes32)']);
const tokenMetadataResponseSchema = z.object({ tokens: z.record(z.unknown()) });
const resolvedTokenInfoSchema = z.object({
  token: z.object({
    id: z.string(),
    address: z.string(),
    symbol: z.string(),
    name: z.string(),
    decimals: z.number().int().min(0).max(255),
  }),
  isRecognized: z.boolean(),
});
const tokenMetadataCacheKey = (key: string): string => `token-metadata:v1:${key}`;

const getTokenMetadataClientUrl = (): string => {
  if (!DATA_API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_DATA_API_BASE_URL is required.');
  }

  return `${DATA_API_BASE_URL}/v1/tokens/metadata`;
};

const normalizeAddress = (value: string): string => value.toLowerCase();

const formatUnknownTokenLabel = (address: string): string => {
  const normalizedAddress = normalizeAddress(address);
  return `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;
};

const normalizeTokenSymbol = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const decodeBytes32Symbol = (value: Hex): string | undefined => {
  const hexValue = value.slice(2);
  let decoded = '';

  for (let index = 0; index < hexValue.length; index += 2) {
    const codePoint = Number.parseInt(hexValue.slice(index, index + 2), 16);
    if (codePoint === 0) {
      break;
    }

    decoded += String.fromCharCode(codePoint);
  }

  return normalizeTokenSymbol(decoded);
};

const dedupeTokenInputs = (tokens: TokenAddressInput[]): TokenAddressInput[] => {
  const deduped = new Map<string, TokenAddressInput>();

  for (const token of tokens) {
    const normalizedAddress = normalizeAddress(token.address);
    const key = infoToKey(normalizedAddress, token.chainId);

    if (!deduped.has(key)) {
      deduped.set(key, {
        address: normalizedAddress,
        chainId: token.chainId,
      });
    }
  }

  return Array.from(deduped.values());
};

const groupTokenInputsByChain = (tokens: TokenAddressInput[]): Map<SupportedNetworks, TokenAddressInput[]> => {
  const tokensByChain = new Map<SupportedNetworks, TokenAddressInput[]>();

  for (const token of tokens) {
    const tokensForChain = tokensByChain.get(token.chainId) ?? [];
    tokensForChain.push(token);
    tokensByChain.set(token.chainId, tokensForChain);
  }

  return tokensByChain;
};

const findResolvedToken = (address: string, chainId: SupportedNetworks, trustedTokens: ERC20Token[] = []): ERC20Token | undefined => {
  const localToken = findToken(address, chainId);
  if (localToken) {
    return localToken;
  }

  return trustedTokens.find((token) =>
    token.networks.some((network) => network.address.toLowerCase() === address.toLowerCase() && network.chain.id === chainId),
  );
};

const getOrCreateTokenMetadata = (metadataByToken: Map<string, OnchainTokenMetadata>, key: string): OnchainTokenMetadata => {
  const existing = metadataByToken.get(key);
  if (existing) {
    return existing;
  }

  const metadata: OnchainTokenMetadata = {};
  metadataByToken.set(key, metadata);
  return metadata;
};

export const serializeResolvedTokenInfos = (resolvedTokenInfos: Map<string, ResolvedTokenInfo>): SerializedResolvedTokenInfos =>
  Object.fromEntries(resolvedTokenInfos);

export const deserializeResolvedTokenInfos = <T>(value: Record<string, T>): Map<string, T> =>
  new Map(
    Object.entries(value).map(([key, resolvedTokenInfo]) => {
      if (key.includes(':')) {
        const [chainIdRaw, address] = key.split(':');
        const chainId = Number(chainIdRaw);

        if (Number.isInteger(chainId) && address) {
          return [infoToKey(address, chainId), resolvedTokenInfo] satisfies [string, T];
        }
      }

      return [key, resolvedTokenInfo] satisfies [string, T];
    }),
  );

export const fetchOnchainTokenMetadataMap = async (
  tokens: TokenAddressInput[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<Map<string, OnchainTokenMetadata>> => {
  const uniqueTokens = dedupeTokenInputs(tokens);
  const metadataByToken = new Map<string, OnchainTokenMetadata>();

  for (const [chainId, tokensForChain] of groupTokenInputsByChain(uniqueTokens)) {
    const client = getClient(chainId, customRpcUrls[chainId]);

    for (let start = 0; start < tokensForChain.length; start += TOKEN_METADATA_BATCH_SIZE) {
      const tokenBatch = tokensForChain.slice(start, start + TOKEN_METADATA_BATCH_SIZE);
      const [decimalsResults, symbolResults] = await Promise.all([
        client.multicall({
          contracts: tokenBatch.map((token) => ({
            address: token.address as Address,
            abi: erc20Abi,
            functionName: 'decimals' as const,
          })),
          allowFailure: true,
        }),
        client.multicall({
          contracts: tokenBatch.map((token) => ({
            address: token.address as Address,
            abi: erc20Abi,
            functionName: 'symbol' as const,
          })),
          allowFailure: true,
        }),
      ]);

      const bytes32FallbackTokens: TokenAddressInput[] = [];

      for (const [index, token] of tokenBatch.entries()) {
        const key = infoToKey(token.address, chainId);
        const metadata = getOrCreateTokenMetadata(metadataByToken, key);
        const decimalsResult = decimalsResults[index];
        const symbolResult = symbolResults[index];

        if (decimalsResult.status === 'success' && decimalsResult.result !== undefined) {
          metadata.decimals = Number(decimalsResult.result);
        }

        const symbol = symbolResult.status === 'success' ? normalizeTokenSymbol(symbolResult.result) : undefined;

        if (symbol) {
          metadata.symbol = symbol;
          continue;
        }

        bytes32FallbackTokens.push(token);
      }

      if (bytes32FallbackTokens.length === 0) {
        continue;
      }

      const bytes32SymbolResults = await client.multicall({
        contracts: bytes32FallbackTokens.map((token) => ({
          address: token.address as Address,
          abi: erc20SymbolBytes32Abi,
          functionName: 'symbol' as const,
        })),
        allowFailure: true,
      });

      for (const [index, result] of bytes32SymbolResults.entries()) {
        if (result.status !== 'success' || result.result === undefined) {
          continue;
        }

        const token = bytes32FallbackTokens[index];
        const key = infoToKey(token.address, chainId);
        const symbol = decodeBytes32Symbol(result.result);

        if (!symbol) {
          continue;
        }

        getOrCreateTokenMetadata(metadataByToken, key).symbol = symbol;
      }
    }
  }

  return metadataByToken;
};

export const fetchTokenDecimalsMap = async (
  tokens: TokenAddressInput[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<Map<string, number>> => {
  const uniqueTokens = dedupeTokenInputs(tokens);
  const decimalsByToken = new Map<string, number>();
  const unresolvedTokens: TokenAddressInput[] = [];

  for (const token of uniqueTokens) {
    const knownToken = findToken(token.address, token.chainId);

    if (knownToken) {
      decimalsByToken.set(infoToKey(token.address, token.chainId), knownToken.decimals);
      continue;
    }

    unresolvedTokens.push(token);
  }

  const onchainMetadataByToken = await fetchOnchainTokenMetadataMap(unresolvedTokens, customRpcUrls);

  for (const token of unresolvedTokens) {
    const decimals = onchainMetadataByToken.get(infoToKey(token.address, token.chainId))?.decimals;
    if (decimals !== undefined) {
      decimalsByToken.set(infoToKey(token.address, token.chainId), decimals);
    }
  }

  return decimalsByToken;
};

export const resolveUnknownTokenInfosOnchain = async (
  tokens: TokenAddressInput[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<Map<string, ResolvedTokenInfo>> => {
  const uniqueTokens = dedupeTokenInputs(tokens);
  const resolvedTokenInfos = new Map<string, ResolvedTokenInfo>();
  const onchainMetadataByToken = await fetchOnchainTokenMetadataMap(uniqueTokens, customRpcUrls);

  for (const token of uniqueTokens) {
    const key = infoToKey(token.address, token.chainId);
    const onchainMetadata = onchainMetadataByToken.get(key);
    const resolvedDecimals = onchainMetadata?.decimals;

    if (resolvedDecimals === undefined) {
      continue;
    }

    const resolvedSymbol = onchainMetadata?.symbol ?? formatUnknownTokenLabel(token.address);
    resolvedTokenInfos.set(key, {
      token: {
        id: token.address,
        address: token.address,
        symbol: resolvedSymbol,
        name: resolvedSymbol,
        decimals: resolvedDecimals,
      },
      isRecognized: false,
    });
  }

  return resolvedTokenInfos;
};

const fetchResolvedUnknownTokenInfosFromServer = async (tokens: TokenAddressInput[]): Promise<Map<string, ResolvedTokenInfo>> => {
  const batches: TokenAddressInput[][] = [];

  for (let start = 0; start < tokens.length; start += TOKEN_METADATA_BATCH_SIZE) {
    batches.push(tokens.slice(start, start + TOKEN_METADATA_BATCH_SIZE));
  }

  const responses = await Promise.allSettled(
    batches.map(async (tokenBatch) => {
      const response = await fetch(getTokenMetadataClientUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getMonarchApiAuthHeaders(),
        },
        body: JSON.stringify({ tokens: tokenBatch }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token metadata: ${response.status}`);
      }

      const { tokens: responseTokens } = tokenMetadataResponseSchema.parse(await response.json());
      const entries = deserializeResolvedTokenInfos(responseTokens);
      const validEntries = new Map<string, ResolvedTokenInfo>();

      for (const { address, chainId } of tokenBatch) {
        const key = infoToKey(address, chainId);
        const parsed = resolvedTokenInfoSchema.safeParse(entries.get(key));
        if (parsed.success && normalizeAddress(parsed.data.token.address) === address) {
          validEntries.set(key, parsed.data);
        }
      }

      return validEntries;
    }),
  );

  const resolvedTokenInfos = new Map<string, ResolvedTokenInfo>();

  for (const response of responses) {
    if (response.status !== 'fulfilled') {
      continue;
    }

    for (const [key, value] of response.value.entries()) {
      resolvedTokenInfos.set(key, value);
    }
  }

  return resolvedTokenInfos;
};

const resolveUnknownTokenInfos = async (tokens: TokenAddressInput[]): Promise<Map<string, ResolvedTokenInfo>> => {
  const keys = tokens.map(({ address, chainId }) => tokenMetadataCacheKey(infoToKey(address, chainId)));
  const cachedEntries = await readPersistedApiResponses<ResolvedTokenInfo>(keys);
  const resolved = new Map<string, ResolvedTokenInfo>();
  const tokensToFetch: TokenAddressInput[] = [];
  const now = Date.now();

  for (const token of tokens) {
    const key = infoToKey(token.address, token.chainId);
    const cached = cachedEntries.get(tokenMetadataCacheKey(key));
    if (cached) resolved.set(key, cached.data);
    if (!cached || now - cached.updatedAt >= TOKEN_METADATA_CACHE_TTL) tokensToFetch.push(token);
  }

  if (tokensToFetch.length === 0) return resolved;

  const fetched = await fetchResolvedUnknownTokenInfosFromServer(tokensToFetch);
  for (const [key, data] of fetched) resolved.set(key, data);

  // The API can omit a token when resolution fails. Only successful lookups renew the cache.
  if (fetched.size > 0) {
    const updatedAt = Date.now();
    await writePersistedApiResponses(Array.from(fetched, ([key, data]) => [tokenMetadataCacheKey(key), { data, updatedAt }] as const));
  }

  return resolved;
};

export const resolveTokenInfos = async (
  tokens: TokenAddressInput[],
  _customRpcUrls: CustomRpcUrls = {},
  options: ResolveTokenInfosOptions = {},
): Promise<Map<string, ResolvedTokenInfo>> => {
  const uniqueTokens = dedupeTokenInputs(tokens);
  const shouldResolveUnknownTokens = options.resolveUnknownTokens ?? true;
  const trustedTokens = options.trustedTokens ?? [];
  const resolvedTokenInfos = new Map<string, ResolvedTokenInfo>();
  const unresolvedTokens = uniqueTokens.filter((token) => !findResolvedToken(token.address, token.chainId, trustedTokens));
  const unresolvedTokenInfos =
    !shouldResolveUnknownTokens || unresolvedTokens.length === 0
      ? new Map<string, ResolvedTokenInfo>()
      : await resolveUnknownTokenInfos(unresolvedTokens);

  for (const token of uniqueTokens) {
    const key = infoToKey(token.address, token.chainId);
    const knownToken = findResolvedToken(token.address, token.chainId, trustedTokens);

    if (knownToken) {
      resolvedTokenInfos.set(key, {
        token: {
          id: token.address,
          address: token.address,
          symbol: knownToken.symbol,
          name: knownToken.symbol,
          decimals: knownToken.decimals,
        },
        isRecognized: true,
      });
      continue;
    }

    const resolvedUnknownToken = unresolvedTokenInfos.get(key);
    if (resolvedUnknownToken) {
      resolvedTokenInfos.set(key, resolvedUnknownToken);
    }
  }

  return resolvedTokenInfos;
};

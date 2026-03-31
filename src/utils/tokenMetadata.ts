import { erc20Abi, parseAbi, type Address, type Hex } from 'viem';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from './networks';
import { getClient } from './rpc';
import { findToken, infoToKey } from './tokens';
import type { TokenInfo } from './types';

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

const TOKEN_METADATA_BATCH_SIZE = 200;
const erc20SymbolBytes32Abi = parseAbi(['function symbol() view returns (bytes32)']);

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

export const deserializeResolvedTokenInfos = (value: SerializedResolvedTokenInfos): Map<string, ResolvedTokenInfo> =>
  new Map(Object.entries(value));

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
  const response = await fetch('/api/token-metadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tokens }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token metadata: ${response.status}`);
  }

  const data = (await response.json()) as { tokens?: SerializedResolvedTokenInfos };
  return deserializeResolvedTokenInfos(data.tokens ?? {});
};

export const resolveTokenInfos = async (
  tokens: TokenAddressInput[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<Map<string, ResolvedTokenInfo>> => {
  const uniqueTokens = dedupeTokenInputs(tokens);
  const resolvedTokenInfos = new Map<string, ResolvedTokenInfo>();
  const unresolvedTokens = uniqueTokens.filter((token) => !findToken(token.address, token.chainId));
  const serverResolvedTokens = unresolvedTokens.filter((token) => !customRpcUrls[token.chainId]);
  const clientResolvedTokens = unresolvedTokens.filter((token) => Boolean(customRpcUrls[token.chainId]));
  const [serverResolvedTokenInfos, clientResolvedTokenInfos] = await Promise.all([
    serverResolvedTokens.length === 0
      ? Promise.resolve(new Map<string, ResolvedTokenInfo>())
      : typeof window === 'undefined'
        ? resolveUnknownTokenInfosOnchain(serverResolvedTokens, customRpcUrls)
        : fetchResolvedUnknownTokenInfosFromServer(serverResolvedTokens).catch(() =>
            resolveUnknownTokenInfosOnchain(serverResolvedTokens, customRpcUrls),
          ),
    clientResolvedTokens.length === 0
      ? Promise.resolve(new Map<string, ResolvedTokenInfo>())
      : resolveUnknownTokenInfosOnchain(clientResolvedTokens, customRpcUrls),
  ]);
  const unresolvedTokenInfos = new Map<string, ResolvedTokenInfo>([
    ...serverResolvedTokenInfos.entries(),
    ...clientResolvedTokenInfos.entries(),
  ]);

  for (const token of uniqueTokens) {
    const key = infoToKey(token.address, token.chainId);
    const knownToken = findToken(token.address, token.chainId);

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

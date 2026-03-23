import { erc20Abi, type Address } from 'viem';
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

const TOKEN_DECIMALS_BATCH_SIZE = 200;

const normalizeAddress = (value: string): string => value.toLowerCase();

const formatUnknownTokenLabel = (address: string): string => {
  const normalizedAddress = normalizeAddress(address);
  return `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;
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

export const fetchTokenDecimalsMap = async (tokens: TokenAddressInput[]): Promise<Map<string, number>> => {
  const uniqueTokens = dedupeTokenInputs(tokens);
  const decimalsByToken = new Map<string, number>();
  const unresolvedByChain = new Map<SupportedNetworks, TokenAddressInput[]>();

  for (const token of uniqueTokens) {
    const knownToken = findToken(token.address, token.chainId);

    if (knownToken) {
      decimalsByToken.set(infoToKey(token.address, token.chainId), knownToken.decimals);
      continue;
    }

    const tokensForChain = unresolvedByChain.get(token.chainId) ?? [];
    tokensForChain.push(token);
    unresolvedByChain.set(token.chainId, tokensForChain);
  }

  for (const [chainId, tokensForChain] of unresolvedByChain) {
    const client = getClient(chainId);
    for (let start = 0; start < tokensForChain.length; start += TOKEN_DECIMALS_BATCH_SIZE) {
      const tokenBatch = tokensForChain.slice(start, start + TOKEN_DECIMALS_BATCH_SIZE);
      const results = await client.multicall({
        contracts: tokenBatch.map((token) => ({
          address: token.address as Address,
          abi: erc20Abi,
          functionName: 'decimals' as const,
        })),
        allowFailure: true,
      });

      for (const [index, result] of results.entries()) {
        if (result.status !== 'success' || result.result === undefined) {
          continue;
        }

        decimalsByToken.set(infoToKey(tokenBatch[index].address, chainId), Number(result.result));
      }
    }
  }

  return decimalsByToken;
};

export const resolveTokenInfos = async (tokens: TokenAddressInput[]): Promise<Map<string, ResolvedTokenInfo>> => {
  const uniqueTokens = dedupeTokenInputs(tokens);
  const decimalsByToken = await fetchTokenDecimalsMap(uniqueTokens);
  const resolvedTokenInfos = new Map<string, ResolvedTokenInfo>();

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

    const resolvedDecimals = decimalsByToken.get(key);
    if (resolvedDecimals === undefined) {
      continue;
    }

    const fallbackLabel = formatUnknownTokenLabel(token.address);
    resolvedTokenInfos.set(key, {
      token: {
        id: token.address,
        address: token.address,
        symbol: fallbackLabel,
        name: token.address,
        decimals: resolvedDecimals,
      },
      isRecognized: false,
    });
  }

  return resolvedTokenInfos;
};

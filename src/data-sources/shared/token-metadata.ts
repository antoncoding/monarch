import { type Address, erc20Abi } from 'viem';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { infoToKey } from '@/utils/tokens';
import { fetchMergedTokenCatalog, findTokenInCatalog, getLocalTokenCatalog } from '@/utils/tokenCatalog';
import type { TokenInfo } from '@/utils/types';

const DEFAULT_TOKEN_DECIMALS = 18;
const UNKNOWN_TOKEN_NAME = 'Unknown Token';
const TOKEN_METADATA_ADDRESSES_PER_MULTICALL = 100;

const resolvedTokenMetadataCache = new Map<string, TokenInfo>();
const pendingTokenMetadataCache = new Map<string, Promise<TokenInfo>>();

type DeferredTokenInfo = {
  promise: Promise<TokenInfo>;
  resolve: (value: TokenInfo) => void;
};

const createFallbackTokenInfo = (
  address: string,
  chainId: SupportedNetworks,
  metadata?: Partial<Pick<TokenInfo, 'decimals' | 'name' | 'symbol'>>,
): TokenInfo => {
  return {
    address,
    decimals: metadata?.decimals ?? DEFAULT_TOKEN_DECIMALS,
    id: infoToKey(address, chainId),
    name: metadata?.name ?? UNKNOWN_TOKEN_NAME,
    symbol: metadata?.symbol ?? 'Unknown',
  };
};

const toTokenInfoFromCatalog = (
  address: string,
  chainId: SupportedNetworks,
  token: Awaited<ReturnType<typeof fetchMergedTokenCatalog>>[number],
): TokenInfo => {
  return {
    address,
    decimals: token.decimals,
    id: infoToKey(address, chainId),
    name: token.symbol,
    symbol: token.symbol,
  };
};

const dedupeTokenRefs = (tokenRefs: { address: string; chainId: SupportedNetworks }[]): { address: string; chainId: SupportedNetworks }[] => {
  const uniqueTokenRefs = new Map<string, { address: string; chainId: SupportedNetworks }>();

  for (const tokenRef of tokenRefs) {
    uniqueTokenRefs.set(infoToKey(tokenRef.address, tokenRef.chainId), tokenRef);
  }

  return Array.from(uniqueTokenRefs.values());
};

const createDeferredTokenInfo = (): DeferredTokenInfo => {
  let resolve!: (value: TokenInfo) => void;
  const promise = new Promise<TokenInfo>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

const chunkAddresses = (addresses: string[]): string[][] => {
  const chunks: string[][] = [];

  for (let index = 0; index < addresses.length; index += TOKEN_METADATA_ADDRESSES_PER_MULTICALL) {
    chunks.push(addresses.slice(index, index + TOKEN_METADATA_ADDRESSES_PER_MULTICALL));
  }

  return chunks;
};

export const fetchTokenMetadataMap = async (
  tokenRefs: { address: string; chainId: SupportedNetworks }[],
  customRpcUrls?: CustomRpcUrls,
): Promise<Map<string, TokenInfo>> => {
  const metadataMap = new Map<string, TokenInfo>();

  if (tokenRefs.length === 0) {
    return metadataMap;
  }

  const dedupedTokenRefs = dedupeTokenRefs(tokenRefs);
  const tokenCatalog = await fetchMergedTokenCatalog().catch(() => getLocalTokenCatalog());
  const unresolvedByChain = new Map<SupportedNetworks, string[]>();
  const pendingEntries: Array<{ key: string; promise: Promise<TokenInfo> }> = [];

  for (const tokenRef of dedupedTokenRefs) {
    const key = infoToKey(tokenRef.address, tokenRef.chainId);
    const cachedTokenInfo = resolvedTokenMetadataCache.get(key);

    if (cachedTokenInfo) {
      metadataMap.set(key, cachedTokenInfo);
      continue;
    }

    const catalogToken = findTokenInCatalog(tokenCatalog, tokenRef.address, tokenRef.chainId);

    if (catalogToken) {
      const tokenInfo = toTokenInfoFromCatalog(tokenRef.address, tokenRef.chainId, catalogToken);
      resolvedTokenMetadataCache.set(key, tokenInfo);
      metadataMap.set(key, tokenInfo);
      continue;
    }

    const pendingTokenInfo = pendingTokenMetadataCache.get(key);

    if (pendingTokenInfo) {
      pendingEntries.push({ key, promise: pendingTokenInfo });
      continue;
    }

    const chainAddresses = unresolvedByChain.get(tokenRef.chainId) ?? [];
    chainAddresses.push(tokenRef.address);
    unresolvedByChain.set(tokenRef.chainId, chainAddresses);
  }

  await Promise.allSettled(
    Array.from(unresolvedByChain.entries()).map(async ([chainId, addresses]) => {
      const uniqueAddresses = [...new Set(addresses)];

      if (uniqueAddresses.length === 0) {
        return;
      }

      const deferredByKey = new Map<string, DeferredTokenInfo>();

      for (const address of uniqueAddresses) {
        const key = infoToKey(address, chainId);
        const deferred = createDeferredTokenInfo();
        deferredByKey.set(key, deferred);
        pendingTokenMetadataCache.set(key, deferred.promise);
      }

      try {
        const client = getClient(chainId, customRpcUrls?.[chainId]);

        for (const addressChunk of chunkAddresses(uniqueAddresses)) {
          try {
            const contracts = addressChunk.flatMap((address) => [
              {
                abi: erc20Abi,
                address: address as Address,
                functionName: 'symbol' as const,
              },
              {
                abi: erc20Abi,
                address: address as Address,
                functionName: 'name' as const,
              },
              {
                abi: erc20Abi,
                address: address as Address,
                functionName: 'decimals' as const,
              },
            ]);

            const results = await client.multicall({
              allowFailure: true,
              contracts,
            });

            for (const [index, address] of addressChunk.entries()) {
              const symbolResult = results[index * 3];
              const nameResult = results[index * 3 + 1];
              const decimalsResult = results[index * 3 + 2];

              const tokenInfo = createFallbackTokenInfo(address, chainId, {
                decimals:
                  decimalsResult?.status === 'success' && typeof decimalsResult.result === 'number'
                    ? decimalsResult.result
                    : DEFAULT_TOKEN_DECIMALS,
                name:
                  nameResult?.status === 'success' && typeof nameResult.result === 'string'
                    ? nameResult.result
                    : UNKNOWN_TOKEN_NAME,
                symbol: symbolResult?.status === 'success' && typeof symbolResult.result === 'string' ? symbolResult.result : 'Unknown',
              });

              const key = infoToKey(address, chainId);
              resolvedTokenMetadataCache.set(key, tokenInfo);
              metadataMap.set(key, tokenInfo);
              deferredByKey.get(key)?.resolve(tokenInfo);
            }
          } catch {
            for (const address of addressChunk) {
              const key = infoToKey(address, chainId);
              const tokenInfo = createFallbackTokenInfo(address, chainId);
              metadataMap.set(key, tokenInfo);
              deferredByKey.get(key)?.resolve(tokenInfo);
            }
          }
        }
      } catch {
        for (const address of uniqueAddresses) {
          const key = infoToKey(address, chainId);
          const tokenInfo = createFallbackTokenInfo(address, chainId);
          metadataMap.set(key, tokenInfo);
          deferredByKey.get(key)?.resolve(tokenInfo);
        }
      } finally {
        for (const key of deferredByKey.keys()) {
          pendingTokenMetadataCache.delete(key);
        }
      }
    }),
  );

  if (pendingEntries.length > 0) {
    const resolvedPendingEntries = await Promise.all(
      pendingEntries.map(async ({ key, promise }) => ({
        key,
        tokenInfo: await promise,
      })),
    );

    for (const pendingEntry of resolvedPendingEntries) {
      metadataMap.set(pendingEntry.key, pendingEntry.tokenInfo);
    }
  }

  return metadataMap;
};

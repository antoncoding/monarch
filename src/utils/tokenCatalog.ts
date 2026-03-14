import { z } from 'zod';
import { SupportedNetworks, getViemChain } from '@/utils/networks';
import { supportedTokens, type ERC20Token } from '@/utils/tokens';

const PendleAssetSchema = z.object({
  address: z.string(),
  chainId: z.number(),
  symbol: z.string(),
  decimals: z.number(),
  proIcon: z.string().nullable(),
});

type PendleAsset = z.infer<typeof PendleAssetSchema>;

const TOKEN_CATALOG_TTL_MS = 5 * 60 * 1000;
const PENDLE_FETCH_TIMEOUT_MS = 5_000;
const PENDLE_SUPPORTED_CHAIN_IDS = [
  SupportedNetworks.Mainnet,
  SupportedNetworks.Base,
  SupportedNetworks.Arbitrum,
  SupportedNetworks.HyperEVM,
] as const;

const localTokensWithSource: ERC20Token[] = supportedTokens.map((token) => ({
  ...token,
  source: 'local',
}));

let tokenCatalogCache:
  | {
      expiresAt: number;
      promise: Promise<ERC20Token[]>;
    }
  | null = null;

const fetchPendleAssets = async (chainId: number): Promise<PendleAsset[]> => {
  const abortController = new AbortController();
  const timeoutHandle = globalThis.setTimeout(() => abortController.abort(), PENDLE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api-v2.pendle.finance/core/v1/${chainId}/assets/all`, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as PendleAsset[];
    return z.array(PendleAssetSchema).parse(data);
  } catch (error) {
    console.error(`Error fetching Pendle assets for chain ${chainId}:`, error);
    return [];
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
};

const convertPendleAssetToToken = (asset: PendleAsset, chainId: SupportedNetworks): ERC20Token => {
  return {
    decimals: asset.decimals,
    img: asset.proIcon ?? undefined,
    isFactoryToken: true,
    networks: [
      {
        address: asset.address,
        chain: getViemChain(chainId),
      },
    ],
    protocol: {
      name: 'Pendle',
    },
    source: 'external',
    symbol: asset.symbol,
  };
};

const mergeCatalogTokens = (externalTokens: ERC20Token[]): ERC20Token[] => {
  const filteredExternalTokens = externalTokens.filter((externalToken) => {
    return !externalToken.networks.some((externalNetwork) =>
      supportedTokens.some((supportedToken) =>
        supportedToken.networks.some(
          (supportedNetwork) =>
            supportedNetwork.address.toLowerCase() === externalNetwork.address.toLowerCase() &&
            supportedNetwork.chain.id === externalNetwork.chain.id,
        ),
      ),
    );
  });

  return [...localTokensWithSource, ...filteredExternalTokens];
};

export const getLocalTokenCatalog = (): ERC20Token[] => {
  return localTokensWithSource;
};

export const fetchMergedTokenCatalog = async (): Promise<ERC20Token[]> => {
  const now = Date.now();

  if (tokenCatalogCache && tokenCatalogCache.expiresAt > now) {
    return tokenCatalogCache.promise;
  }

  const promise = (async () => {
    try {
      const settledExternalTokenGroups = await Promise.allSettled(
        PENDLE_SUPPORTED_CHAIN_IDS.map(async (chainId) => {
          const assets = await fetchPendleAssets(chainId);
          return assets.map((asset) => convertPendleAssetToToken(asset, chainId));
        }),
      );

      const externalTokenGroups = settledExternalTokenGroups.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      return mergeCatalogTokens(externalTokenGroups.flat());
    } catch (error) {
      tokenCatalogCache = null;
      throw error;
    }
  })();

  tokenCatalogCache = {
    expiresAt: now + TOKEN_CATALOG_TTL_MS,
    promise,
  };

  return promise;
};

export const findTokenInCatalog = (tokens: ERC20Token[], address: string, chainId: number): ERC20Token | undefined => {
  if (!address || !chainId) {
    return undefined;
  }

  return tokens.find((token) =>
    token.networks.some((network) => network.address.toLowerCase() === address.toLowerCase() && network.chain.id === chainId),
  );
};

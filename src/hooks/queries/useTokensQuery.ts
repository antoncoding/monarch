import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { SupportedNetworks, getViemChain } from '@/utils/networks';
import { supportedTokens } from '@/utils/tokens';
import type { ERC20Token } from '@/utils/tokens';

const PendleAssetSchema = z.object({
  address: z.string(),
  chainId: z.number(),
  symbol: z.string(),
  decimals: z.number(),
  proIcon: z.string().nullable(),
});

type PendleAsset = z.infer<typeof PendleAssetSchema>;

const localTokensWithSource: ERC20Token[] = supportedTokens.map((token) => ({
  ...token,
  source: 'local',
}));
const PENDLE_SUPPORTED_NETWORKS = [
  SupportedNetworks.Mainnet,
  SupportedNetworks.Optimism,
  SupportedNetworks.Base,
  SupportedNetworks.Arbitrum,
  SupportedNetworks.HyperEVM,
  SupportedNetworks.Monad,
] as const;
const TOKEN_METADATA_STALE_TIME = 30 * 60 * 1000;
const TOKEN_METADATA_REFETCH_INTERVAL = 30 * 60 * 1000;

async function fetchPendleAssets(chainId: number): Promise<PendleAsset[]> {
  const response = await fetch(`https://api-v2.pendle.finance/core/v1/${chainId}/assets/all`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Pendle assets for chain ${chainId}: ${response.status}`);
  }

  const data = z.array(z.unknown()).parse(await response.json());
  const assets: PendleAsset[] = [];
  for (const item of data) {
    const parsedAsset = PendleAssetSchema.safeParse(item);
    if (parsedAsset.success) assets.push(parsedAsset.data);
  }
  return assets;
}

function convertPendleAssetToToken(asset: PendleAsset, chainId: SupportedNetworks): ERC20Token {
  return {
    symbol: asset.symbol,
    decimals: asset.decimals,
    img: asset.proIcon ?? undefined,
    networks: [
      {
        chain: getViemChain(chainId),
        address: asset.address,
      },
    ],
    isFactoryToken: true,
    protocol: {
      name: 'Pendle',
    },
    source: 'external',
  };
}

// Fetches tokens from Pendle API and merges with local tokens
export const useTokensQuery = () => {
  const query = useQuery({
    queryKey: ['tokens'],
    queryFn: async () => {
      const assetsByNetwork = await Promise.all(
        PENDLE_SUPPORTED_NETWORKS.map(async (network) => {
          const assets = await fetchPendleAssets(network);
          return assets.map((asset) => convertPendleAssetToToken(asset, network));
        }),
      );
      const pendleTokens = assetsByNetwork.flat();

      const filteredPendleTokens = pendleTokens.filter((pendleToken) => {
        return !pendleToken.networks.some((pendleNetwork) =>
          supportedTokens.some((supportedToken) =>
            supportedToken.networks.some(
              (supportedNetwork) =>
                supportedNetwork.address.toLowerCase() === pendleNetwork.address.toLowerCase() &&
                supportedNetwork.chain.id === pendleNetwork.chain.id,
            ),
          ),
        );
      });

      return [...localTokensWithSource, ...filteredPendleTokens];
    },
    staleTime: TOKEN_METADATA_STALE_TIME,
    refetchInterval: TOKEN_METADATA_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
  });

  const allTokens = query.data ?? localTokensWithSource;

  const findToken = useCallback(
    (address: string, chainId: number) => {
      if (!address || !chainId) return undefined;
      return allTokens.find((token) =>
        token.networks.some((network) => network.address?.toLowerCase() === address.toLowerCase() && network.chain.id === chainId),
      );
    },
    [allTokens],
  );

  const getUniqueTokens = useCallback(
    (tokenList: { address: string; chainId: number }[]) => {
      return allTokens.filter((token) => {
        return tokenList.find((item) =>
          token.networks.find(
            (network) => network.address.toLowerCase() === item.address.toLowerCase() && network.chain.id === item.chainId,
          ),
        );
      });
    },
    [allTokens],
  );

  return {
    allTokens,
    findToken,
    getUniqueTokens,
    hasFetchedTokens: query.data !== undefined,
    isLoading: query.isLoading,
    isError: query.isError || query.isRefetchError || query.failureCount > 0,
    error: query.error,
    refetch: query.refetch,
  };
};

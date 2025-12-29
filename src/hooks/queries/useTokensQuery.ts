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

async function fetchPendleAssets(chainId: number): Promise<PendleAsset[]> {
  try {
    const response = await fetch(`https://api-v2.pendle.finance/core/v1/${chainId}/assets/all`);
    if (!response.ok) return [];
    const data = (await response.json()) as PendleAsset[];
    return z.array(PendleAssetSchema).parse(data);
  } catch (error) {
    console.error(`Error fetching Pendle assets for chain ${chainId}:`, error);
    return [];
  }
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
      try {
        const [mainnetAssets, baseAssets, arbitrumAssets, hyperevmAssets] = await Promise.all([
          fetchPendleAssets(SupportedNetworks.Mainnet),
          fetchPendleAssets(SupportedNetworks.Base),
          fetchPendleAssets(SupportedNetworks.Arbitrum),
          fetchPendleAssets(SupportedNetworks.HyperEVM),
        ]);

        const pendleTokens = [
          ...mainnetAssets.map((a) => convertPendleAssetToToken(a, SupportedNetworks.Mainnet)),
          ...baseAssets.map((a) => convertPendleAssetToToken(a, SupportedNetworks.Base)),
          ...arbitrumAssets.map((a) => convertPendleAssetToToken(a, SupportedNetworks.Arbitrum)),
          ...hyperevmAssets.map((a) => convertPendleAssetToToken(a, SupportedNetworks.HyperEVM)),
        ];

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
      } catch (err) {
        console.error('Error fetching Pendle assets:', err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
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
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

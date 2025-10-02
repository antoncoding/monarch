import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { SupportedNetworks, getViemChain } from '@/utils/networks';
import { supportedTokens } from '@/utils/tokens';
import type { ERC20Token } from '@/utils/tokens';

// Only parse the fields we need
const PendleAssetSchema = z.object({
  address: z.string(),
  chainId: z.number(),
  symbol: z.string(),
  decimals: z.number(),
  proIcon: z.string().nullable(),
});

type PendleAsset = z.infer<typeof PendleAssetSchema>;

type TokenContextType = {
  allTokens: ERC20Token[];
  findToken: (address: string, chainId: number) => ERC20Token | undefined;
  getUniqueTokens: (tokenList: { address: string; chainId: number }[]) => ERC20Token[];
};

const TokenContext = createContext<TokenContextType | null>(null);

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
  };
}

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [allTokens, setAllTokens] = useState<ERC20Token[]>(supportedTokens);

  useEffect(() => {
    async function fetchAllAssets() {
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

        // Filter out Pendle tokens that have addresses already present in supportedTokens
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

        setAllTokens([...supportedTokens, ...filteredPendleTokens]);
      } catch (err) {
        console.error('Error fetching Pendle assets:', err);
      }
    }

    void fetchAllAssets();
  }, []);

  const findToken = useCallback(
    (address: string, chainId: number) => {
      if (!address || !chainId) return undefined;
      return allTokens.find((token) =>
        token.networks.some(
          (network) =>
            network.address?.toLowerCase() === address.toLowerCase() && network.chain.id === chainId,
        ),
      );
    },
    [allTokens],
  );

  const getUniqueTokens = useCallback(
    (tokenList: { address: string; chainId: number }[]) => {
      return allTokens.filter((token) => {
        return tokenList.find((item) =>
          token.networks.find(
            (network) =>
              network.address.toLowerCase() === item.address.toLowerCase() &&
              network.chain.id === item.chainId,
          ),
        );
      });
    },
    [allTokens],
  );

  const value = useMemo(
    () => ({ allTokens, findToken, getUniqueTokens }),
    [allTokens, findToken, getUniqueTokens],
  );

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

export function useTokens() {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useTokens must be used within a TokenProvider');
  }
  return context;
}

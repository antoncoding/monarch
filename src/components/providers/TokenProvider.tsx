import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { mainnet, base } from 'viem/chains';
import { z } from 'zod';
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

function convertPendleAssetToToken(asset: PendleAsset): ERC20Token {
  return {
    symbol: asset.symbol,
    decimals: asset.decimals,
    img: asset.proIcon ?? undefined,
    networks: [
      {
        chain: asset.chainId === 1 ? mainnet : base,
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
        const [mainnetAssets, baseAssets] = await Promise.all([
          fetchPendleAssets(1),
          fetchPendleAssets(8453),
        ]);
        const pendleTokens = [
          ...mainnetAssets.map(convertPendleAssetToToken),
          ...baseAssets.map(convertPendleAssetToToken),
        ];

        setAllTokens([...supportedTokens, ...pendleTokens]);
      } catch (err) {
        console.error('Error fetching Pendle assets:', err);
      }
    }

    void fetchAllAssets();
  }, []);

  const findToken = useCallback(
    (address: string, chainId: number) => {
      return allTokens.find((token) =>
        token.networks.some(
          (network) =>
            network.address.toLowerCase() === address.toLowerCase() && network.chain.id === chainId,
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

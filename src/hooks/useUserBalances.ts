import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { SupportedNetworks } from '@/utils/networks';
import { findToken } from '@/utils/tokens';

type TokenBalance = {
  address: string;
  balance: string;
  chainId: number;
  decimals: number;
  logoURI?: string;
  symbol: string;
};

type TokenResponse = {
  tokens: {
    address: string;
    balance: string;
  }[];
};

export function useUserBalances() {
  const { address } = useAccount();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalances = useCallback(
    async (chainId: number): Promise<TokenResponse['tokens']> => {
      try {
        const response = await fetch(`/api/balances?address=${address}&chainId=${chainId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch balances');
        }
        const data = (await response.json()) as TokenResponse;
        return data.tokens;
      } catch (err) {
        console.error('Error fetching balances:', err);
        throw err instanceof Error ? err : new Error('Unknown error occurred');
      }
    },
    [address],
  );

  const fetchAllBalances = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch balances from both chains
      const [mainnetBalances, baseBalances] = await Promise.all([
        fetchBalances(SupportedNetworks.Mainnet),
        fetchBalances(SupportedNetworks.Base),
      ]);

      // Process and filter tokens
      const processedBalances: TokenBalance[] = [];

      const processTokens = (tokens: TokenResponse['tokens'], chainId: number) => {
        tokens.forEach((token) => {
          const tokenInfo = findToken(token.address, chainId);
          if (tokenInfo) {
            processedBalances.push({
              address: token.address,
              balance: token.balance,
              chainId,
              decimals: tokenInfo.decimals,
              logoURI: tokenInfo.img,
              symbol: tokenInfo.symbol,
            });
          }
        });
      };

      processTokens(mainnetBalances, 1);
      processTokens(baseBalances, 8453);

      setBalances(processedBalances);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      console.error('Error fetching all balances:', err);
    } finally {
      setLoading(false);
    }
  }, [address, fetchBalances]);

  useEffect(() => {
    void fetchAllBalances();
  }, [fetchAllBalances]);

  return {
    balances,
    loading,
    error,
    refetch: fetchAllBalances,
  };
}

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { findToken } from '@/utils/tokens';

type TokenBalance = {
  address: string;
  balance: string;
  chainId: number;
  decimals: number;
  logoURI?: string;
  symbol: string;
};

export function useUserBalances() {
  const { address } = useAccount();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalances = useCallback(async (chainId: number) => {
    try {
      const response = await fetch(`/api/balances?address=${address}&chainId=${chainId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch balances');
      }
      const data = await response.json();
      return data.tokens;
    } catch (err) {
      console.error('Error fetching balances:', err);
      throw err;
    }
  }, [address]);

  const fetchAllBalances = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch balances from both chains
      const [mainnetBalances, baseBalances] = await Promise.all([
        fetchBalances(1),
        fetchBalances(8453)
      ]);

      // Process and filter tokens
      const processedBalances: TokenBalance[] = [];
      
      const processTokens = (tokens: any[], chainId: number) => {
        tokens.forEach(token => {
          const tokenInfo = findToken(token.address, chainId);
          if (tokenInfo) {
            processedBalances.push({
              address: token.address,
              balance: token.balance,
              chainId,
              decimals: tokenInfo.decimals,
              logoURI: tokenInfo.img,
              symbol: tokenInfo.symbol
            });
          }
        });
      };

      processTokens(mainnetBalances, 1);
      processTokens(baseBalances, 8453);

      setBalances(processedBalances);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching all balances:', err);
    } finally {
      setLoading(false);
    }
  }, [address, fetchBalances]);

  useEffect(() => {
    fetchAllBalances();
  }, [fetchAllBalances]);

  return {
    balances,
    loading,
    error,
    refetch: fetchAllBalances
  };
}

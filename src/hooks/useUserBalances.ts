import { useCallback, useEffect, useState, useMemo } from 'react';
import { useConnection } from 'wagmi';
import { useTokens } from '@/components/providers/TokenProvider';
import { type SupportedNetworks, ALL_SUPPORTED_NETWORKS } from '@/utils/networks';

export type TokenBalance = {
  address: string;
  balance: string;
  chainId: number;
  decimals: number;

  symbol: string;
};

type TokenResponse = {
  tokens: {
    address: string;
    balance: string;
  }[];
};

type UseUserBalancesOptions = {
  networkIds?: SupportedNetworks[];
};

export function useUserBalances(options: UseUserBalancesOptions = {}) {
  const { address } = useConnection();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { findToken } = useTokens();

  // Get networks to fetch from - either specified ones or agent-enabled networks
  const networksToFetch = useMemo(() => {
    return options.networkIds ?? ALL_SUPPORTED_NETWORKS;
  }, [options.networkIds]);

  const fetchBalances = useCallback(
    async (chainId: number): Promise<TokenResponse['tokens']> => {
      try {
        const response = await fetch(`/api/balances?address=${address}&chainId=${chainId}`);
        if (!response.ok) {
          const errorMessage = await response
            .json()
            .then((errorData) => (errorData?.error as string | undefined) ?? 'Failed to fetch balances')
            .catch(() => 'Failed to fetch balances');
          throw new Error(errorMessage);
        }
        const data = (await response.json()) as TokenResponse;
        return data.tokens;
      } catch (err) {
        console.error(`Error fetching balances for chain ${chainId}:`, err);
        throw err instanceof Error ? err : new Error('Unknown error occurred');
      }
    },
    [address],
  );

  const fetchAllBalances = useCallback(async () => {
    if (!address) {
      setBalances([]);
      setLoading(false);
      return;
    }

    if (networksToFetch.length === 0) {
      setBalances([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch balances from specified networks only
      const balancePromises = networksToFetch.map(async (chainId) => {
        try {
          const tokens = await fetchBalances(chainId);
          return { chainId, tokens };
        } catch (err) {
          return {
            chainId,
            tokens: [],
            error: err instanceof Error ? err : new Error('Unknown error occurred'),
          };
        }
      });

      const networkResults = await Promise.all(balancePromises);

      // Process and filter tokens
      const processedBalances: TokenBalance[] = [];
      const failedChainIds: number[] = [];
      const errorMessages: string[] = [];

      const processTokens = (tokens: TokenResponse['tokens'], chainId: number) => {
        tokens.forEach((token) => {
          const tokenInfo = findToken(token.address, chainId);
          if (tokenInfo) {
            processedBalances.push({
              address: token.address,
              balance: token.balance,
              chainId,
              decimals: tokenInfo.decimals,
              symbol: tokenInfo.symbol,
            });
          }
        });
      };

      networkResults.forEach((result) => {
        processTokens(result.tokens, result.chainId);

        if (result.error) {
          failedChainIds.push(result.chainId);
          if (result.error.message) {
            errorMessages.push(result.error.message);
          }
        }
      });

      setBalances(processedBalances);

      if (failedChainIds.length > 0) {
        const fallbackMessage = `Failed to fetch balances for chains: ${failedChainIds.join(', ')}`;
        const aggregatedMessage = errorMessages.length > 0 ? [...new Set(errorMessages)].join(' | ') : fallbackMessage;
        setError(new Error(aggregatedMessage));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      console.error('Error fetching balances:', err);
    } finally {
      setLoading(false);
    }
  }, [address, fetchBalances, networksToFetch]);

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

// Helper function to fetch balances from all networks (for backward compatibility)
export function useUserBalancesAllNetworks() {
  return useUserBalances({
    networkIds: ALL_SUPPORTED_NETWORKS,
  });
}

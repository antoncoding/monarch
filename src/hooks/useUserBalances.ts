import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useTokens } from '@/components/providers/TokenProvider';
import { SupportedNetworks, networks, isAgentAvailable } from '@/utils/networks';

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
  const { address } = useAccount();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { findToken } = useTokens();

  // Get networks to fetch from - either specified ones or agent-enabled networks
  const networksToFetch = useMemo(() => {
    return options.networkIds ?? networks
      .filter(network => isAgentAvailable(network.network))
      .map(network => network.network);
  }, [options.networkIds]);

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
      const balancePromises = networksToFetch.map(async (chainId) => await fetchBalances(chainId));
      const networkBalances = await Promise.all(balancePromises);

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
              symbol: tokenInfo.symbol,
            });
          }
        });
      };

      // Process each network's results
      networkBalances.forEach((tokens, index) => {
        const chainId = networksToFetch[index];
        if (chainId) {
          processTokens(tokens, chainId);
        }
      });

      setBalances(processedBalances);
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
    networkIds: [
      SupportedNetworks.Mainnet,
      SupportedNetworks.Base,
      SupportedNetworks.Polygon,
      SupportedNetworks.Arbitrum,
      SupportedNetworks.Unichain,
    ]
  });
}

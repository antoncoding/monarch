import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
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
  address?: string;
  networkIds?: SupportedNetworks[];
  enabled?: boolean;
};

/**
 * Fetches user token balances across specified networks using React Query.
 *
 * Data fetching strategy:
 * - Fetches balances from API endpoint for each network
 * - Enriches balance data with token metadata from useTokensQuery
 * - Filters out tokens not found in token registry
 * - Gracefully handles individual network failures
 *
 * Cache behavior:
 * - staleTime: 30 seconds (balance data changes frequently)
 * - Refetch on window focus: enabled
 * - Only runs when address is provided
 *
 * @example
 * ```tsx
 * const { data: balances, isLoading, error } = useUserBalancesQuery({
 *   address: '0x...',
 *   networkIds: [SupportedNetworks.Mainnet, SupportedNetworks.Base],
 * });
 * ```
 */
export const useUserBalancesQuery = (options: UseUserBalancesOptions = {}) => {
  const { address: connectedAddress } = useConnection();
  const { findToken } = useTokensQuery();

  const address = options.address ?? connectedAddress;
  const networksToFetch = options.networkIds ?? ALL_SUPPORTED_NETWORKS;
  const enabled = options.enabled ?? true;

  return useQuery<TokenBalance[], Error>({
    queryKey: ['user-balances', address, networksToFetch],
    queryFn: async () => {
      if (!address) {
        return [];
      }

      if (networksToFetch.length === 0) {
        return [];
      }

      try {
        // Fetch balances from specified networks only
        const balancePromises = networksToFetch.map(async (chainId) => {
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
            return { chainId, tokens: data.tokens };
          } catch (err) {
            console.warn(`Failed to fetch balances for chain ${chainId}:`, err);
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

        networkResults.forEach((result) => {
          result.tokens.forEach((token) => {
            const tokenInfo = findToken(token.address, result.chainId);
            if (tokenInfo) {
              processedBalances.push({
                address: token.address,
                balance: token.balance,
                chainId: result.chainId,
                decimals: tokenInfo.decimals,
                symbol: tokenInfo.symbol,
              });
            }
          });

          if (result.error) {
            failedChainIds.push(result.chainId);
            if (result.error.message) {
              errorMessages.push(result.error.message);
            }
          }
        });

        // Only throw error if ALL networks failed
        if (failedChainIds.length > 0 && failedChainIds.length === networksToFetch.length) {
          const fallbackMessage = 'All networks failed to fetch balances';
          const aggregatedMessage = errorMessages.length > 0 ? [...new Set(errorMessages)].join(' | ') : fallbackMessage;
          throw new Error(aggregatedMessage);
        }

        return processedBalances;
      } catch (err) {
        console.error('Error fetching balances:', err);
        throw err instanceof Error ? err : new Error('Unknown error occurred');
      }
    },
    enabled: enabled && Boolean(address),
    staleTime: 30_000, // 30 seconds - balances change frequently
    refetchOnWindowFocus: true,
  });
};

/**
 * Helper hook to fetch balances from all networks (for backward compatibility).
 *
 * @example
 * ```tsx
 * const { data: balances, isLoading, error } = useUserBalancesAllNetworksQuery();
 * ```
 */
export const useUserBalancesAllNetworksQuery = () => {
  return useUserBalancesQuery({
    networkIds: ALL_SUPPORTED_NETWORKS,
  });
};

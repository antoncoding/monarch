import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ERC20Token } from '@/utils/tokens';
import { fetchMergedTokenCatalog, findTokenInCatalog, getLocalTokenCatalog } from '@/utils/tokenCatalog';

// Fetches tokens from Pendle API and merges with local tokens
export const useTokensQuery = () => {
  const query = useQuery({
    queryKey: ['tokens'],
    queryFn: async () => {
      return fetchMergedTokenCatalog();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const allTokens: ERC20Token[] = query.data ?? getLocalTokenCatalog();

  const findToken = useCallback(
    (address: string, chainId: number) => {
      return findTokenInCatalog(allTokens, address, chainId);
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

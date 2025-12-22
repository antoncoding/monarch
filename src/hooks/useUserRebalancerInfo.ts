import { useState, useEffect, useCallback } from 'react';
import { userRebalancerInfoQuery } from '@/graphql/morpho-api-queries';
import { networks, isAgentAvailable } from '@/utils/networks';
import type { UserRebalancerInfo } from '@/utils/types';
import { getMonarchAgentUrl } from '@/utils/urls';

/**
 * Get monarch v1 rebalancer info
 * @param account
 * @returns
 */
export function useUserRebalancerInfo(account: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserRebalancerInfo[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const fetchData = useCallback(async () => {
    if (!account) {
      setLoading(false);
      setData([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const agentNetworks = networks.filter((network) => isAgentAvailable(network.network)).map((network) => network.network);

      const promises = agentNetworks.map(async (networkId) => {
        const apiUrl = getMonarchAgentUrl(networkId);
        if (!apiUrl) return null;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: userRebalancerInfoQuery,
            variables: { id: account.toLowerCase() },
          }),
        });

        const json = (await response.json()) as {
          data?: { user?: UserRebalancerInfo };
        };

        if (json.data?.user) {
          return {
            ...json.data.user,
            network: networkId,
          } as UserRebalancerInfo;
        }
        return null;
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((result): result is UserRebalancerInfo => result !== null);

      setData(validResults);
    } catch (err) {
      console.error('Error fetching rebalancer info:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    rebalancerInfos: data,
    loading,
    error,
    refetch: fetchData,
  };
}

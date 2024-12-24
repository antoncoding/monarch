import { useState, useEffect, useCallback } from 'react';
import { userRebalancerInfoQuery } from '@/graphql/queries';
import { UserRebalancerInfo } from '@/utils/types';
import { URLS } from '@/utils/urls';

export function useUserRebalancerInfo(account: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserRebalancerInfo | undefined>();
  const [error, setError] = useState<unknown | null>(null);

  const fetchData = useCallback(async () => {
    if (!account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(URLS.MONARCH_AGENT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userRebalancerInfoQuery,
          variables: { id: account.toLowerCase() },
        }),
      });

      const json = (await response.json()) as { data?: { user?: UserRebalancerInfo } };

      if (json.data?.user) {
        setData(json.data.user);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching rebalancer info:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    rebalancerInfo: data,
    loading,
    error,
    refetch: fetchData,
  };
}

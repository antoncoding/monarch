'use client';

import { usePathname } from 'next/navigation';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useMerklCampaignsQuery } from '@/hooks/queries/useMerklCampaignsQuery';
import { useOracleDataQuery } from '@/hooks/queries/useOracleDataQuery';

function DataPrefetcherContent() {
  useMarketsQuery();
  useTokensQuery();
  useMerklCampaignsQuery();
  useOracleDataQuery();

  return null;
}

/**
 * Triggeres data prefetching for markets, tokens, and Merkl campaigns.
 * These hooks use React Query under the hood, which will cache the data for future use.
 * @returns
 */
export function DataPrefetcher() {
  const pathname = usePathname();

  if (pathname?.startsWith('/ui-lab')) {
    return null;
  }

  return <DataPrefetcherContent />;
}

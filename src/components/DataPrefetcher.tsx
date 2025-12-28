'use client';

import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useMerklCampaignsQuery } from '@/hooks/queries/useMerklCampaignsQuery';

/**
 * Triggeres data prefetching for markets, tokens, and Merkl campaigns.
 * These hooks use React Query under the hood, which will cache the data for future use.
 * @returns 
 */
export function DataPrefetcher() {
  useMarketsQuery();
  useTokensQuery();
  useMerklCampaignsQuery();
  return null;
}

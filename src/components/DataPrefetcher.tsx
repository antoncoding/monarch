'use client';

import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useMerklCampaignsQuery } from '@/hooks/queries/useMerklCampaignsQuery';

export function DataPrefetcher() {
  useMarketsQuery();
  useTokensQuery();
  useMerklCampaignsQuery();
  return null;
}

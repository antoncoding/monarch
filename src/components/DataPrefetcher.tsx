'use client';

import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';

export function DataPrefetcher() {
  useMarketsQuery();
  useTokensQuery();
  return null;
}

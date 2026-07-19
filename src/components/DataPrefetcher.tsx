'use client';

import { usePathname } from 'next/navigation';
import { useMorphoWhitelistStatusQuery } from '@/hooks/queries/useMorphoWhitelistStatusQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';

function DataPrefetcherContent() {
  useMorphoWhitelistStatusQuery();
  useTokensQuery();

  return null;
}

/**
 * Triggers data prefetching for tokens and whitelist metadata.
 * These hooks use React Query under the hood, which will cache the data for future use.
 * @returns
 */
export function DataPrefetcher() {
  const pathname = usePathname();

  if (pathname?.startsWith('/analysis')) {
    return null;
  }

  return <DataPrefetcherContent />;
}

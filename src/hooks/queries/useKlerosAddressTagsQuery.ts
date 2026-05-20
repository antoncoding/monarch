import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchKlerosAddressTags,
  KLEROS_ADDRESS_TAGS_GC_TIME_MS,
  KLEROS_ADDRESS_TAGS_STALE_TIME_MS,
  normalizeKlerosAddressList,
  type KlerosAddressTagsByKey,
} from '@/data-sources/kleros/address-tags';

const EMPTY_KLEROS_ADDRESS_TAGS: KlerosAddressTagsByKey = {};

export function useKlerosAddressTagsQuery(chainId: number | undefined, addresses: readonly string[] | undefined) {
  const normalizedAddresses = useMemo(() => normalizeKlerosAddressList(addresses ?? []), [addresses]);

  return useQuery<KlerosAddressTagsByKey>({
    queryKey: ['kleros-address-tags', chainId, normalizedAddresses],
    queryFn: ({ signal }) => {
      if (!chainId) {
        return EMPTY_KLEROS_ADDRESS_TAGS;
      }

      return fetchKlerosAddressTags({ addresses: normalizedAddresses, chainId, signal });
    },
    enabled: Boolean(chainId && normalizedAddresses.length > 0),
    staleTime: KLEROS_ADDRESS_TAGS_STALE_TIME_MS,
    gcTime: KLEROS_ADDRESS_TAGS_GC_TIME_MS,
    placeholderData: (previousData) => previousData ?? EMPTY_KLEROS_ADDRESS_TAGS,
    retry: false,
  });
}

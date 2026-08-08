import { useMemo } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';

export function usePortfolioAddressOptions(seedAccounts: Address[] = []): Address[] {
  const addressBookmarks = usePortfolioBookmarks((state) => state.addressBookmarks);
  const visitedAddresses = usePortfolioBookmarks((state) => state.visitedAddresses);

  return useMemo(() => {
    const accounts = new Map<string, Address>();
    for (const entry of [
      ...seedAccounts,
      ...addressBookmarks.map((item) => item.address),
      ...visitedAddresses.map((item) => item.address),
    ]) {
      if (!isAddress(entry, { strict: false })) continue;
      const account = getAddress(entry);
      accounts.set(account.toLowerCase(), account);
    }
    return Array.from(accounts.values());
  }, [addressBookmarks, seedAccounts, visitedAddresses]);
}

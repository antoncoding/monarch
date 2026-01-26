import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import type { Address } from 'viem';
import { StyledToast } from '@/components/ui/styled-toast';
import { INDEXING_TIMEOUT_MS, useVaultIndexingStore } from '@/stores/vault-indexing-store';
import { useStyledToast } from './useStyledToast';

type UseVaultIndexingArgs = {
  vaultAddress: Address;
  chainId: number;
  hasPostInitData: boolean;
  refetch: () => void;
};

const REFETCH_INTERVAL_MS = 10_000;

/**
 * Hook to manage vault indexing state after initialization.
 * Shows a persistent toast and retries fetching data every 10 seconds
 * until post-initialization data arrives or timeout is reached (10 minutes).
 *
 * Uses Zustand store for instant reactivity (no localStorage polling).
 */
export function useVaultIndexing({ vaultAddress, chainId, hasPostInitData, refetch }: UseVaultIndexingArgs) {
  // Use selectors for individual pieces to avoid subscribing to the entire store
  const indexingVault = useVaultIndexingStore((s) => s.indexingVault);
  const stopIndexing = useVaultIndexingStore((s) => s.stopIndexing);
  const toastIdRef = useRef<string | number>();
  const { info: styledInfo, success: styledSuccess } = useStyledToast();

  // Derive isIndexing from the store state
  // Time-based expiry is handled by the interval in Effect 2 (not reactive to time passing)
  const isIndexing = useMemo(() => {
    if (!indexingVault) return false;
    return indexingVault.address.toLowerCase() === vaultAddress.toLowerCase() && indexingVault.chainId === chainId;
  }, [indexingVault, vaultAddress, chainId]);

  // Effect 1: Show/dismiss the persistent "indexing" toast
  useEffect(() => {
    if (isIndexing && !toastIdRef.current) {
      toastIdRef.current = toast.info(
        <StyledToast
          title="Indexing vault data..."
          message="This can take up to 10 minutes. We're refreshing automatically."
        />,
        {
          autoClose: false,
          toastId: `indexing-${vaultAddress}-${chainId}`,
        },
      );
    }

    if (!isIndexing && toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = undefined;
    }
  }, [isIndexing, vaultAddress, chainId]);

  // Effect 2: Refetch interval + timeout while indexing.
  // Only re-runs when isIndexing changes (true→false or false→true).
  // refetch is stable (vault-view depends on .refetch refs from React Query).
  // stopIndexing is stable (Zustand action created once).
  // styledInfo is stable (useCallback with empty deps).
  useEffect(() => {
    if (!isIndexing) return;

    const startTime = indexingVault?.startTime ?? Date.now();

    // Fire an immediate refetch
    refetch();

    const intervalId = setInterval(() => {
      if (Date.now() - startTime > INDEXING_TIMEOUT_MS) {
        clearInterval(intervalId);
        stopIndexing();
        styledInfo('Indexing delayed', 'Data is taking longer than 10 minutes. Please try refreshing manually using the refresh button.');
        return;
      }

      refetch();
    }, REFETCH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIndexing]);

  // Effect 3: Detect completion — fresh post-init data arrived while indexing
  useEffect(() => {
    if (isIndexing && hasPostInitData) {
      stopIndexing();
      styledSuccess('Vault data loaded', 'Your vault is ready to use.');
    }
  }, [isIndexing, hasPostInitData, stopIndexing, styledSuccess]);

  // Cleanup toast on unmount
  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  return { isIndexing };
}

import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import type { Address } from 'viem';
import { getIndexingVault, stopVaultIndexing } from '@/utils/vault-indexing';
import { useStyledToast } from './useStyledToast';

type UseVaultIndexingArgs = {
  vaultAddress: Address;
  chainId: number;
  isDataLoaded: boolean;
  refetch: () => void;
};

/**
 * Hook to manage vault indexing state after initialization.
 * Shows a persistent toast and retries fetching data every 5 seconds
 * until the vault is indexed or timeout is reached (2 minutes).
 */
export function useVaultIndexing({ vaultAddress, chainId, isDataLoaded, refetch }: UseVaultIndexingArgs) {
  const [isIndexing, setIsIndexing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const toastIdRef = useRef<string | number>();
  const pollingRef = useRef<NodeJS.Timeout>();
  const hasDetectedIndexing = useRef(false);
  const styledToast = useStyledToast();

  // Continuously poll localStorage to detect when indexing state is set
  // This ensures we pick up indexing state even if it's set after component mount
  useEffect(() => {
    // Initial check
    const initialIndexingData = getIndexingVault(vaultAddress, chainId);
    if (initialIndexingData && !hasDetectedIndexing.current) {
      hasDetectedIndexing.current = true;
      setIsIndexing(true);
      // Stop polling once detected
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
      return;
    }

    // Poll every second to detect indexing state changes
    pollingRef.current = setInterval(() => {
      const polledIndexingData = getIndexingVault(vaultAddress, chainId);
      if (polledIndexingData && !hasDetectedIndexing.current) {
        hasDetectedIndexing.current = true;
        setIsIndexing(true);
        // Stop polling once detected
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = undefined;
        }
      }
    }, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
    };
  }, [vaultAddress, chainId]); // Removed isIndexing from deps to prevent re-polling

  // Handle indexing toast and retry logic
  useEffect(() => {
    if (!isIndexing) return;

    // Show persistent toast when indexing starts (only once)
    if (!toastIdRef.current) {
      toastIdRef.current = styledToast.info(
        'Indexing vault data...',
        "This should only take a moment. We're refreshing automatically.",
        { autoClose: false, toastId: `indexing-${vaultAddress}-${chainId}` }, // Use unique ID to prevent duplicates
      );
    }

    // Success: data loaded
    if (isDataLoaded) {
      stopVaultIndexing(vaultAddress, chainId);
      setIsIndexing(false);
      hasDetectedIndexing.current = false; // Reset for future use

      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
      }

      styledToast.success('Vault data loaded', 'Your vault is ready to use.');

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }

      return;
    }

    // Start retry interval if not already running
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        // Check if timeout reached (auto-cleanup happens in getIndexingVault)
        const stillIndexing = getIndexingVault(vaultAddress, chainId);

        if (!stillIndexing) {
          // Timeout reached
          setIsIndexing(false);
          hasDetectedIndexing.current = false; // Reset for future use

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }

          if (toastIdRef.current) {
            toast.dismiss(toastIdRef.current);
            toastIdRef.current = undefined;
          }

          styledToast.info(
            'Indexing delayed',
            'Data is taking longer than expected. Please try refreshing manually using the refresh button.',
          );
          return;
        }

        // Trigger refetch
        refetch();
      }, 5000); // Every 5 seconds (faster since API responds quickly)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [isIndexing, isDataLoaded, vaultAddress, chainId, refetch, styledToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
      hasDetectedIndexing.current = false; // Reset on unmount
    };
  }, []);

  return { isIndexing };
}

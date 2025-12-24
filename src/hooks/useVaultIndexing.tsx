import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import type { Address } from 'viem';
import { StyledToast } from '@/components/ui/styled-toast';
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
  const refetchIntervalRef = useRef<NodeJS.Timeout>();
  const toastIdRef = useRef<string | number>();
  const hasDetectedIndexing = useRef(false);
  const styledToast = useStyledToast();

  // Poll localStorage to detect when indexing state is set
  // This ensures we pick up indexing state even if it's set after component mount
  useEffect(() => {
    // Immediate check on mount
    const indexingData = getIndexingVault(vaultAddress, chainId);
    if (indexingData && !hasDetectedIndexing.current) {
      hasDetectedIndexing.current = true;
      setIsIndexing(true);
    }

    // Continue polling for state changes
    const pollingInterval = setInterval(() => {
      const data = getIndexingVault(vaultAddress, chainId);
      if (data && !hasDetectedIndexing.current) {
        hasDetectedIndexing.current = true;
        setIsIndexing(true);
      }
    }, 1000);

    // Always return cleanup function
    return () => {
      clearInterval(pollingInterval);
    };
  }, [vaultAddress, chainId]);

  // Handle indexing toast and retry logic
  useEffect(() => {
    if (!isIndexing) return;

    // Show persistent toast when indexing starts (only once)
    if (!toastIdRef.current) {
      toastIdRef.current = toast.info(
        <StyledToast
          title="Indexing vault data..."
          message="This should only take a moment. We're refreshing automatically."
        />,
        {
          autoClose: false,
          toastId: `indexing-${vaultAddress}-${chainId}`,
        },
      );
    }

    // Success: data loaded
    if (isDataLoaded) {
      stopVaultIndexing(vaultAddress, chainId);
      setIsIndexing(false);
      hasDetectedIndexing.current = false;

      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
      }

      styledToast.success('Vault data loaded', 'Your vault is ready to use.');

      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
        refetchIntervalRef.current = undefined;
      }

      return;
    }

    // Start retry interval if not already running
    if (!refetchIntervalRef.current) {
      refetchIntervalRef.current = setInterval(() => {
        // Check if timeout reached (auto-cleanup happens in getIndexingVault)
        const stillIndexing = getIndexingVault(vaultAddress, chainId);

        if (!stillIndexing) {
          // Timeout reached
          setIsIndexing(false);
          hasDetectedIndexing.current = false;

          if (refetchIntervalRef.current) {
            clearInterval(refetchIntervalRef.current);
            refetchIntervalRef.current = undefined;
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
      }, 5000);
    }

    return () => {
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
        refetchIntervalRef.current = undefined;
      }
    };
  }, [isIndexing, isDataLoaded, vaultAddress, chainId, refetch, styledToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
      hasDetectedIndexing.current = false;
    };
  }, []);

  return { isIndexing };
}

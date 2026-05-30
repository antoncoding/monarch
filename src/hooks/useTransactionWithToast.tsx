import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { StyledToast, TransactionToast } from '@/components/ui/styled-toast';
import { reportHandledError } from '@/utils/sentry';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import { cacheUserTransactionHistoryFromReceipt } from '@/utils/user-transaction-history-cache';
import { getExplorerTxURL } from '../utils/external';
import type { SupportedNetworks } from '../utils/networks';
import { usePlatformFeeTracking, type PlatformFeeEventInput } from './usePlatformFeeTracking';
import { useReferralAttributionTracking } from './useReferralAttributionTracking';

interface UseTransactionWithToastProps {
  toastId: string;
  pendingText: string;
  successText: string;
  errorText: string;
  chainId?: number;
  pendingDescription?: string;
  successDescription?: string;
  onSuccess?: () => void;
  platformFeeEvents?: PlatformFeeEventInput[];
}

const MAX_TOAST_MESSAGE_LENGTH = 160;
const NO_PLATFORM_FEE_EVENTS: PlatformFeeEventInput[] = [];

const truncateToastMessage = (message: string): string => {
  if (message.length <= MAX_TOAST_MESSAGE_LENGTH) {
    return message;
  }
  return `${message.slice(0, MAX_TOAST_MESSAGE_LENGTH - 3)}...`;
};

export function useTransactionWithToast({
  toastId,
  pendingText,
  successText,
  errorText,
  chainId,
  pendingDescription,
  successDescription,
  onSuccess,
  platformFeeEvents = NO_PLATFORM_FEE_EVENTS,
}: UseTransactionWithToastProps) {
  const { data: hash, mutate: sendTransaction, error: txError, mutateAsync: sendTransactionAsync } = useSendTransaction();
  const reportedErrorKeyRef = useRef<string | null>(null);
  const handledConfirmationHashRef = useRef<string | null>(null);
  const { trackPlatformFeeEvents } = usePlatformFeeTracking();
  const { trackReferralAttribution } = useReferralAttributionTracking();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 0,
  });

  // Use a ref to store the latest onSuccess callback without it being in the dependency array
  // This prevents infinite loops when the callback is recreated on every render
  const onSuccessRef = useRef(onSuccess);

  // Update the ref whenever onSuccess changes
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const onClick = useCallback(() => {
    if (hash) {
      // if chainId is not supported, use 1
      const chainIdToUse = chainId ?? 1;
      window.open(getExplorerTxURL(hash, chainIdToUse as SupportedNetworks), '_blank');
    }
  }, [hash, chainId]);

  useEffect(() => {
    if (isConfirming) {
      toast.loading(
        <TransactionToast
          title={pendingText}
          description={pendingDescription}
          hash={hash}
        />,
        {
          toastId,
          onClick,
          closeButton: true,
        },
      );
    }
  }, [isConfirming, pendingText, pendingDescription, toastId, onClick, hash]);

  useEffect(() => {
    if (isConfirmed && hash) {
      if (handledConfirmationHashRef.current === hash) {
        return;
      }
      handledConfirmationHashRef.current = hash;

      toast.update(toastId, {
        render: (
          <TransactionToast
            title={`${successText} 🎉`}
            description={successDescription}
            hash={hash}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 5000,
        onClick,
        closeButton: true,
      });

      if (receipt && hash && chainId) {
        cacheUserTransactionHistoryFromReceipt({
          receipt,
          txHash: hash,
          chainId,
        });
      }

      if (hash && chainId) {
        // We intentionally record the submitted hash. Wallet replacement from gas bumps is rare enough
        // to reconcile from chain data later; keeping this path simple is the right tradeoff for now.
        void trackReferralAttribution({ chainId, txHash: hash }).catch(() => undefined);

        if (platformFeeEvents.length > 0) {
          void trackPlatformFeeEvents({
            chainId,
            txHash: hash,
            events: platformFeeEvents,
          }).catch(() => undefined);
        }
      }

      if (onSuccessRef.current) {
        onSuccessRef.current();
      }
    }
    if (isError || txError) {
      const errorToReport = txError ?? receiptError ?? new Error('Transaction failed while waiting for confirmation');
      const reportKey = `${toastId}:${hash ?? 'no_hash'}:${errorToReport.message}`;

      if (reportedErrorKeyRef.current !== reportKey) {
        reportHandledError(errorToReport, {
          scope: 'transaction',
          operation: pendingText,
          level: 'error',
          tags: {
            tx_toast_id: toastId,
            tx_chain_id: chainId ?? 'unknown',
            tx_has_hash: Boolean(hash),
          },
          extras: {
            tx_hash: hash ?? null,
            tx_error_message: errorToReport.message,
            tx_error_name: errorToReport.name,
          },
        });
        reportedErrorKeyRef.current = reportKey;
      }

      const errorMessage = toUserFacingTransactionErrorMessage(txError ?? receiptError, 'Transaction failed');

      toast.update(toastId, {
        render: (
          <StyledToast
            title={errorText}
            message={truncateToastMessage(errorMessage)}
          />
        ),
        type: 'error',
        isLoading: false,
        autoClose: 5000,
        onClick,
        closeButton: true,
      });
    } else {
      reportedErrorKeyRef.current = null;
    }
  }, [
    hash,
    isConfirmed,
    isError,
    txError,
    receiptError,
    receipt,
    successText,
    successDescription,
    errorText,
    toastId,
    onClick,
    chainId,
    pendingText,
    platformFeeEvents,
    trackPlatformFeeEvents,
    trackReferralAttribution,
  ]);

  return { sendTransactionAsync, sendTransaction, isConfirming, isConfirmed };
}

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { StyledToast, TransactionToast } from '@/components/ui/styled-toast';
import { clearStoredReferralCode, getStoredReferralCode } from '@/utils/referrals';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import { cacheUserTransactionHistoryFromReceipt } from '@/utils/user-transaction-history-cache';
import { getExplorerTxURL } from '../utils/external';
import type { SupportedNetworks } from '../utils/networks';

interface UseTransactionWithToastProps {
  toastId: string;
  pendingText: string;
  successText: string;
  errorText: string;
  chainId?: number;
  pendingDescription?: string;
  successDescription?: string;
  onSuccess?: () => void;
}

const MAX_TOAST_MESSAGE_LENGTH = 160;

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
}: UseTransactionWithToastProps) {
  const { data: hash, mutate: sendTransaction, error: txError, mutateAsync: sendTransactionAsync } = useSendTransaction();
  const handledConfirmationHashRef = useRef<string | null>(null);

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

      if (receipt && hash && chainId) {
        const referralCode = getStoredReferralCode();
        if (referralCode) {
          void fetch('/api/referrals/attribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referredWallet: receipt.from,
              referralCode,
              chainId,
              txHash: hash,
            }),
          })
            .then((response) => {
              if (response.ok) clearStoredReferralCode();
            })
            .catch(() => undefined);
        }
      }

      if (onSuccessRef.current) {
        onSuccessRef.current();
      }
    }
    if (isError || txError) {
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
    }
  }, [hash, isConfirmed, isError, txError, receiptError, receipt, successText, successDescription, errorText, toastId, onClick, chainId]);

  return { sendTransactionAsync, sendTransaction, isConfirming, isConfirmed };
}

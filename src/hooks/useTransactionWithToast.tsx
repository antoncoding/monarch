import { useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { StyledToast, TransactionToast } from '@/components/common/StyledToast';
import { getExplorerTxURL } from '../utils/external';
import type { SupportedNetworks } from '../utils/networks';

type UseTransactionWithToastProps = {
  toastId: string;
  pendingText: string;
  successText: string;
  errorText: string;
  chainId?: number;
  pendingDescription?: string;
  successDescription?: string;
  onSuccess?: () => void;
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
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError,
  } = useWaitForTransactionReceipt({
    hash,
  });

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
    if (isConfirmed) {
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
      if (onSuccess) {
        onSuccess();
      }
    }
    if (isError || txError) {
      toast.update(toastId, {
        render: (
          <StyledToast
            title={errorText}
            message={txError ? txError.message : 'Transaction Failed'}
          />
        ),
        type: 'error',
        isLoading: false,
        autoClose: 5000,
        onClick,
        closeButton: true,
      });
    }
  }, [hash, isConfirmed, isError, txError, successText, successDescription, errorText, toastId, onClick, onSuccess]);

  return { sendTransactionAsync, sendTransaction, isConfirming, isConfirmed };
}

import React, { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { TxHashDisplay } from '@/components/TxHashDisplay';
import { getExplorerTxURL } from '../utils/external';
import { SupportedNetworks } from '../utils/networks';

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
  const {
    data: hash,
    sendTransaction,
    error: txError,
    sendTransactionAsync,
  } = useSendTransaction();
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
    if (isConfirming && hash) {
      toast.loading(pendingText, {
        id: toastId,
        description: (
          <div className="font-zen">
            {pendingDescription && <div className="mb-2 mt-1 text-sm">{pendingDescription}</div>}
            <TxHashDisplay hash={hash} />
          </div>
        ),
        action: hash
          ? {
              label: 'View',
              onClick,
            }
          : undefined,
        className: 'font-zen',
      });
    }
  }, [isConfirming, pendingText, pendingDescription, toastId, onClick, hash]);

  useEffect(() => {
    if (isConfirmed) {
      if (hash) {
        toast.success(`${successText} 🎉`, {
          id: toastId,
          description: (
            <div className="font-zen">
              {successDescription && <div className="mb-2 mt-1 text-sm">{successDescription}</div>}
              <TxHashDisplay hash={hash} />
            </div>
          ),
          action: {
            label: 'View',
            onClick,
          },
          duration: 5000,
          className: 'font-zen',
        });
        if (onSuccess) {
          onSuccess();
        }
      }
    }
    if (isError || txError) {
      toast.error(errorText, {
        id: toastId,
        description: (
          <div className="font-zen">
            <div className="py-2 font-inter text-xs">
              {txError ? txError.message : 'Transaction Failed'}
            </div>
            {hash && <TxHashDisplay hash={hash} />}
          </div>
        ),
        action: hash
          ? {
              label: 'View',
              onClick,
            }
          : undefined,
        duration: 5000,
        className: 'font-zen',
      });
    }
  }, [
    hash,
    isConfirmed,
    isError,
    txError,
    successText,
    successDescription,
    errorText,
    toastId,
    onClick,
    onSuccess,
  ]);

  return { sendTransactionAsync, sendTransaction, isConfirming, isConfirmed };
}

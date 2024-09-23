import React, { useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { getExplorerTxURL } from '../utils/external';
import { SupportedNetworks } from '../utils/networks';

export function useTransactionWithToast(
  toastId: string,
  pendingText: string,
  successText: string,
  errorText: string,
  chainId?: number,
) {
  const { data: hash, sendTransaction, error: txError } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
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
        <div className="p-2">
          <div>{pendingText}</div>
          <div className="underline-on-hover py-2 font-mono text-xs">
            {hash ? `Tx Hash: ${hash.slice(0, 6)}...${hash.slice(-4)}` : ''}
          </div>
        </div>,
        {
          toastId,
          onClick,
        },
      );
    }
  }, [isConfirming, pendingText, toastId, hash, onClick]);

  useEffect(() => {
    if (isConfirmed) {
      toast.update(toastId, {
        render: (
          <div className="p-2">
            <div>{successText} 🎉</div>
            <div className="underline-on-hover py-2 font-mono text-xs">
              {hash ? `Tx Hash: ${hash.slice(0, 6)}...${hash.slice(-4)}` : ''}
            </div>
          </div>
        ),
        type: 'success',
        isLoading: false,
        autoClose: 5000,
        onClick,
      });
    }
    if (txError) {
      toast.update(toastId, {
        render: (
          <div className="p-2">
            <div>{errorText}</div>
            <div className="underline-on-hover py-2 font-mono text-xs">{txError.message}</div>
          </div>
        ),
        type: 'error',
        isLoading: false,
        autoClose: 5000,
        onClick,
      });
    }
  }, [isConfirmed, txError, successText, toastId, errorText, hash, onClick]);

  return { sendTransaction, isConfirming, isConfirmed };
}

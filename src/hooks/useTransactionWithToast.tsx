import React, { useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { TxHashDisplay } from '../components/TxHashDisplay';
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
};

export function useTransactionWithToast({
  toastId,
  pendingText,
  successText,
  errorText,
  chainId,
  pendingDescription,
  successDescription,
}: UseTransactionWithToastProps) {
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

  const renderToastContent = useCallback(
    (title: string, description?: string) => (
      <div className="p-2">
        <div>{title}</div>
        {description && <div className="mb-2 mt-1 text-sm">{description}</div>}
        <TxHashDisplay hash={hash} />
      </div>
    ),
    [hash],
  );

  useEffect(() => {
    if (isConfirming) {
      toast.loading(renderToastContent(pendingText, pendingDescription), {
        toastId,
        onClick,
      });
    }
  }, [isConfirming, pendingText, pendingDescription, toastId, onClick, renderToastContent]);

  useEffect(() => {
    if (isConfirmed) {
      toast.update(toastId, {
        render: renderToastContent(`${successText} 🎉`, successDescription),
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
            <div className="py-2 font-mono text-xs hover:underline">{txError.message}</div>
          </div>
        ),
        type: 'error',
        isLoading: false,
        autoClose: 5000,
        onClick,
      });
    }
  }, [
    isConfirmed,
    txError,
    successText,
    successDescription,
    errorText,
    toastId,
    onClick,
    renderToastContent,
  ]);

  return { sendTransaction, isConfirming, isConfirmed };
}

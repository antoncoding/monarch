// Import the necessary hooks
import { useEffect } from 'react';

import { toast } from 'react-hot-toast';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

export function useTransactionWithToast(
  toastId: string,
  pendingText: string,
  successText: string,
  errorText: string,
) {
  const { data: hash, writeContract, error: txError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isConfirming) {
      toast.loading(pendingText, { id: toastId });
    }
  }, [isConfirming, pendingText, toastId]);

  useEffect(() => {
    if (isConfirmed) {
      toast.success(successText, { id: toastId });
    }
    if (txError) {
      toast.error(errorText, { id: toastId });
    }
  }, [isConfirmed, txError, successText, toastId, errorText]);

  return { writeContract, isConfirming, isConfirmed };
}

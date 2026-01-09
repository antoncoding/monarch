import { useCallback, useRef, useState } from 'react';
import { useTransactionProcessStore, type TransactionType, type TransactionStep } from '@/stores/useTransactionProcessStore';

type TransactionMetadata = {
  tokenSymbol?: string;
  amount?: bigint;
  marketId?: string;
  vaultName?: string;
};

/**
 * Hook that simplifies transaction tracking with the global store.
 * Encapsulates all the boilerplate for starting, updating, completing transactions.
 */
export function useTransactionTracking(type: TransactionType) {
  const { startTransaction, updateStep, completeTransaction, failTransaction, setModalVisible } = useTransactionProcessStore();
  const txIdRef = useRef<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const start = useCallback(
    (steps: TransactionStep[], metadata: TransactionMetadata, initialStep: string) => {
      setShowModal(true);
      txIdRef.current = startTransaction({ type, currentStep: initialStep, steps, metadata });
    },
    [startTransaction, type],
  );

  const update = useCallback(
    (step: string) => {
      if (txIdRef.current) updateStep(txIdRef.current, step);
    },
    [updateStep],
  );

  const complete = useCallback(() => {
    if (txIdRef.current) {
      completeTransaction(txIdRef.current);
      txIdRef.current = null;
    }
    setShowModal(false);
  }, [completeTransaction]);

  const fail = useCallback(() => {
    if (txIdRef.current) {
      failTransaction(txIdRef.current);
      txIdRef.current = null;
    }
    setShowModal(false);
  }, [failTransaction]);

  const setModalOpen = useCallback(
    (show: boolean) => {
      setShowModal(show);
      if (txIdRef.current) setModalVisible(txIdRef.current, show);
    },
    [setModalVisible],
  );

  return { start, update, complete, fail, showModal, setModalOpen };
}

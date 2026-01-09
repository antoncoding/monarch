import { type SetStateAction, useCallback, useRef, useState } from 'react';
import { useTransactionProcessStore, type TransactionStep } from '@/stores/useTransactionProcessStore';

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
export function useTransactionTracking(type: string) {
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
    (value: SetStateAction<boolean>) => {
      setShowModal((prev) => {
        const newValue = typeof value === 'function' ? value(prev) : value;
        if (txIdRef.current) setModalVisible(txIdRef.current, newValue);
        return newValue;
      });
    },
    [setModalVisible],
  );

  return { start, update, complete, fail, showModal, setModalOpen };
}

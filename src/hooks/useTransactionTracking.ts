import { type SetStateAction, useCallback, useState } from 'react';
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
 *
 * Modal visibility is derived from the store, so reopening via TransactionIndicator works.
 */
export function useTransactionTracking(type: string) {
  const { startTransaction, updateStep, completeTransaction, failTransaction, setModalVisible } = useTransactionProcessStore();
  const [txId, setTxId] = useState<string | null>(null);

  // Derive showModal from store based on txId
  const showModal = useTransactionProcessStore((s) => (txId ? (s.transactions[txId]?.isModalVisible ?? false) : false));

  const start = useCallback(
    (steps: TransactionStep[], metadata: TransactionMetadata, initialStep: string) => {
      const id = startTransaction({ type, currentStep: initialStep, steps, metadata });
      setTxId(id);
    },
    [startTransaction, type],
  );

  const update = useCallback(
    (step: string) => {
      if (txId) updateStep(txId, step);
    },
    [updateStep, txId],
  );

  const complete = useCallback(() => {
    if (txId) {
      completeTransaction(txId);
      setTxId(null);
    }
  }, [completeTransaction, txId]);

  const fail = useCallback(() => {
    if (txId) {
      failTransaction(txId);
      setTxId(null);
    }
  }, [failTransaction, txId]);

  const setModalOpen = useCallback(
    (value: SetStateAction<boolean>) => {
      if (!txId) return;
      const newValue = typeof value === 'function' ? value(showModal) : value;
      setModalVisible(txId, newValue);
    },
    [setModalVisible, txId, showModal],
  );

  return { start, update, complete, fail, showModal, setModalOpen };
}

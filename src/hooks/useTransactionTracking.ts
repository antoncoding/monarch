import { type SetStateAction, useCallback, useState } from 'react';
import { useTransactionProcessStore, type TransactionStep, type ActiveTransaction } from '@/stores/useTransactionProcessStore';

type TransactionMetadata = {
  tokenSymbol?: string;
  amount?: bigint;
  marketId?: string;
  vaultName?: string;
};

/**
 * Hook that simplifies transaction tracking with the global store.
 *
 * ## Usage
 * ```tsx
 * const tracking = useTransactionTracking('supply');
 *
 * const handleSupply = async () => {
 *   tracking.start(steps, { tokenSymbol: 'USDC' }, 'approve');
 *   try {
 *     await doApproval();
 *     tracking.update('signing');
 *     await doSign();
 *     tracking.update('supplying');
 *     await doSupply();
 *     tracking.complete();
 *   } catch (error) {
 *     tracking.fail();
 *   }
 * };
 *
 * return (
 *   <ProcessModal
 *     transaction={tracking.transaction}
 *     onDismiss={tracking.dismiss}
 *     title="Supply"
 *   />
 * );
 * ```
 */
export function useTransactionTracking(type: string) {
  const store = useTransactionProcessStore();
  const [txId, setTxId] = useState<string | null>(null);

  // Derive transaction from store - this is reactive
  const transaction = useTransactionProcessStore((s): ActiveTransaction | null => (txId ? (s.transactions[txId] ?? null) : null));

  // Convenience accessors
  const isVisible = transaction?.isModalVisible ?? false;
  const currentStep = transaction?.currentStep ?? null;
  const steps = transaction?.steps ?? [];

  /**
   * Start a new transaction. Creates entry in store with modal visible.
   */
  const start = useCallback(
    (txSteps: TransactionStep[], metadata: TransactionMetadata, initialStep: string) => {
      const id = store.startTransaction({ type, currentStep: initialStep, steps: txSteps, metadata });
      setTxId(id);
      return id;
    },
    [store, type],
  );

  /**
   * Update the current step of the transaction.
   */
  const update = useCallback(
    (step: string) => {
      if (txId) store.updateStep(txId, step);
    },
    [store, txId],
  );

  /**
   * Mark transaction as complete. Removes from store.
   */
  const complete = useCallback(() => {
    if (txId) {
      store.completeTransaction(txId);
      setTxId(null);
    }
  }, [store, txId]);

  /**
   * Mark transaction as failed. Removes from store.
   * Error display is handled by useTransactionWithToast.
   */
  const fail = useCallback(() => {
    if (txId) {
      store.failTransaction(txId);
      setTxId(null);
    }
  }, [store, txId]);

  /**
   * Dismiss the modal but keep transaction in background.
   * Transaction will appear in TransactionIndicator.
   */
  const dismiss = useCallback(() => {
    if (txId) store.setModalVisible(txId, false);
  }, [store, txId]);

  /**
   * Resume a background transaction - reopens the modal.
   */
  const resume = useCallback(() => {
    if (txId) store.setModalVisible(txId, true);
  }, [store, txId]);

  /**
   * Legacy: Set modal visibility (for backward compatibility).
   * @deprecated Use dismiss() or resume() instead.
   */
  const setModalOpen = useCallback(
    (value: SetStateAction<boolean>) => {
      if (!txId) return;
      const newValue = typeof value === 'function' ? value(isVisible) : value;
      store.setModalVisible(txId, newValue);
    },
    [store, txId, isVisible],
  );

  return {
    // State
    txId,
    transaction,
    isVisible,
    currentStep,
    steps,
    // Actions
    start,
    update,
    complete,
    fail,
    dismiss,
    resume,
    // Legacy aliases for backward compatibility
    showModal: isVisible,
    setModalOpen,
  };
}

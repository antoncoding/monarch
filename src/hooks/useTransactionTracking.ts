import { type SetStateAction, useCallback, useState, useRef } from 'react';
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
 * IMPORTANT: Uses a ref for synchronous txId access to fix React closure problem.
 * When start() is called, setTxId() is async, so update/complete/fail/dismiss
 * would see stale null values without the ref.
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

  // Ref for synchronous access - fixes React closure problem
  const txIdRef = useRef<string | null>(null);
  // State for triggering re-renders when txId changes
  const [txId, setTxId] = useState<string | null>(null);

  // Derive transaction from store using REF (not state) for immediate access
  const transaction = useTransactionProcessStore((s): ActiveTransaction | null =>
    txIdRef.current ? (s.transactions[txIdRef.current] ?? null) : null
  );

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
      txIdRef.current = id;  // Sync update for immediate use
      setTxId(id);           // Async update to trigger re-render
      return id;
    },
    [store, type],
  );

  /**
   * Update the current step of the transaction.
   */
  const update = useCallback(
    (step: string) => {
      if (txIdRef.current) store.updateStep(txIdRef.current, step);
    },
    [store],
  );

  /**
   * Mark transaction as complete. Removes from store.
   */
  const complete = useCallback(() => {
    if (txIdRef.current) {
      store.completeTransaction(txIdRef.current);
      txIdRef.current = null;
      setTxId(null);
    }
  }, [store]);

  /**
   * Mark transaction as failed. Removes from store.
   * Error display is handled by useTransactionWithToast.
   */
  const fail = useCallback(() => {
    if (txIdRef.current) {
      store.failTransaction(txIdRef.current);
      txIdRef.current = null;
      setTxId(null);
    }
  }, [store]);

  /**
   * Dismiss the modal but keep transaction in background.
   * Transaction will appear in TransactionIndicator.
   */
  const dismiss = useCallback(() => {
    if (txIdRef.current) store.setModalVisible(txIdRef.current, false);
  }, [store]);

  /**
   * Resume a background transaction - reopens the modal.
   */
  const resume = useCallback(() => {
    if (txIdRef.current) store.setModalVisible(txIdRef.current, true);
  }, [store]);

  /**
   * Legacy: Set modal visibility (for backward compatibility).
   * @deprecated Use dismiss() or resume() instead.
   */
  const setModalOpen = useCallback(
    (value: SetStateAction<boolean>) => {
      if (!txIdRef.current) return;
      const newValue = typeof value === 'function' ? value(isVisible) : value;
      store.setModalVisible(txIdRef.current, newValue);
    },
    [store, isVisible],
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

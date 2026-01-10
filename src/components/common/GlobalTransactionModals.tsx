'use client';

import { useShallow } from 'zustand/shallow';
import { useTransactionProcessStore } from '@/stores/useTransactionProcessStore';
import { ProcessModal } from './ProcessModal';

/**
 * Global renderer for transaction modals.
 *
 * This component watches the transaction store and renders ProcessModal
 * for any transaction with isModalVisible: true. This allows modals to
 * persist even when the parent component (e.g., SupplyModalContent) unmounts.
 *
 * Place this component once in your app layout.
 */
export function GlobalTransactionModals() {
  const visibleTransactions = useTransactionProcessStore(
    useShallow((s) => Object.values(s.transactions).filter((tx) => tx.isModalVisible)),
  );
  const setModalVisible = useTransactionProcessStore((s) => s.setModalVisible);

  if (visibleTransactions.length === 0) return null;

  return (
    <>
      {visibleTransactions.map((tx) => (
        <ProcessModal
          key={tx.id}
          transaction={tx}
          onDismiss={() => setModalVisible(tx.id, false)}
          title={tx.metadata.title}
          description={tx.metadata.description}
        />
      ))}
    </>
  );
}

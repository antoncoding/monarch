import type React from 'react';
import { Cross2Icon } from '@radix-ui/react-icons';
import { Modal, ModalBody } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { ActiveTransaction, TransactionSummaryItem } from '@/stores/useTransactionProcessStore';

type ProcessModalProps = {
  /**
   * The transaction object from useTransactionTracking.
   * If null or isModalVisible is false, modal won't render.
   */
  transaction: ActiveTransaction | null;
  /**
   * Called when user dismisses the modal.
   * Should call tracking.dismiss() to move tx to background.
   */
  onDismiss: () => void;
  /**
   * Modal title (e.g., "Supply USDC")
   */
  title: string;
  /**
   * Optional description below title
   */
  description?: string;
  /**
   * Additional content rendered above the step list.
   * Use for market info blocks, amounts, etc.
   */
  children?: React.ReactNode;
};

/**
 * Unified process modal for all transaction types.
 *
 * Renders based on transaction.isModalVisible - no conditional rendering needed.
 * When user clicks close, calls onDismiss (which should call tracking.dismiss()).
 *
 * @example
 * ```tsx
 * const tracking = useTransactionTracking('supply');
 *
 * return (
 *   <ProcessModal
 *     transaction={tracking.transaction}
 *     onDismiss={tracking.dismiss}
 *     title={`Supply ${tokenSymbol}`}
 *     description="Supplying to market"
 *   />
 * );
 * ```
 */
function SummaryBlock({ items }: { items: TransactionSummaryItem[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between text-sm">
          <span className="text-secondary">{item.label}</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span>{item.value}</span>
            {item.detail && (
              <span
                className={
                  item.detailColor === 'positive'
                    ? 'text-green-600'
                    : item.detailColor === 'negative'
                      ? 'text-red-500'
                      : 'text-secondary'
                }
              >
                {item.detail}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProcessModal({ transaction, onDismiss, title, description, children }: ProcessModalProps) {
  // Don't render if no transaction or modal is hidden
  if (!transaction?.isModalVisible) return null;

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      size="lg"
      zIndex="process"
      isDismissable={false}
      backdrop="blur"
    >
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div>
          <h2 className="font-zen text-lg">{title}</h2>
          <p className="text-sm text-secondary">{description ?? `${transaction.steps.length} steps`}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-secondary transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Cross2Icon className="h-4 w-4" />
        </button>
      </div>
      <ModalBody className="gap-5">
        {transaction.metadata.summaryItems && transaction.metadata.summaryItems.length > 0 && (
          <SummaryBlock items={transaction.metadata.summaryItems} />
        )}
        {children}
        <ProcessStepList
          steps={transaction.steps}
          currentStep={transaction.currentStep}
        />
      </ModalBody>
    </Modal>
  );
}

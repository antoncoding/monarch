import type React from 'react';
import { FiX } from 'react-icons/fi';
import { Modal, ModalBody } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { ActiveTransaction } from '@/stores/useTransactionProcessStore';

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
          <FiX className="h-4 w-4" />
        </button>
      </div>
      <ModalBody className="gap-5">
        {children}
        <ProcessStepList
          steps={transaction.steps}
          currentStep={transaction.currentStep}
        />
      </ModalBody>
    </Modal>
  );
}

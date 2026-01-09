import type React from 'react';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
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
   * Icon displayed next to title
   */
  icon?: React.ReactNode;
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
 *     icon={<FiUpload />}
 *   >
 *     <MarketInfoBlock market={market} amount={amount} />
 *   </ProcessModal>
 * );
 * ```
 */
export function ProcessModal({ transaction, onDismiss, title, description, icon, children }: ProcessModalProps) {
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
      <ModalHeader
        title={title}
        description={description}
        mainIcon={icon}
        onClose={onDismiss}
      />
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

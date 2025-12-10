import { Input } from '@heroui/react';
import { FiSliders } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { SettingItem, createNumericInputHandler } from './shared-filter-utils';

type BorrowerFiltersModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  minShares: string;
  onMinSharesChange: (value: string) => void;
  loanAssetSymbol: string;
};

export default function BorrowerFiltersModal({
  isOpen,
  onOpenChange,
  minShares,
  onMinSharesChange,
  loanAssetSymbol,
}: BorrowerFiltersModalProps) {
  const handleSharesChange = createNumericInputHandler(onMinSharesChange);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      size="xl"
      zIndex="settings"
    >
      {(onClose) => (
        <>
          <ModalHeader
            title="Borrower Filters"
            description="Filter borrowers by minimum borrow amount"
            mainIcon={<FiSliders className="h-5 w-5" />}
            onClose={onClose}
          />
          <ModalBody className="flex flex-col gap-5">
            <div className="bg-surface-soft flex flex-col gap-4 rounded p-4">
              <h3 className="text-xs uppercase text-secondary">Minimum Amount</h3>
              <p className="-mt-3 mb-1 text-xs text-secondary">Filter borrowers to show only those above the specified minimum amount.</p>
              <SettingItem
                title={`Min Borrow Amount (${loanAssetSymbol})`}
                description="Only show borrowers with borrow amounts above this value."
              >
                <Input
                  aria-label="Minimum borrow amount"
                  placeholder="0"
                  value={minShares}
                  onChange={handleSharesChange}
                  size="sm"
                  type="text"
                  inputMode="decimal"
                  className="w-28"
                  classNames={{ input: 'text-right' }}
                />
              </SettingItem>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              onClick={onClose}
            >
              Close
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

import type React from 'react';
import { Input, Divider } from '@heroui/react';
import { FiSliders } from 'react-icons/fi';
import { Button } from '@/components/common';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';

type TransactionFiltersModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  minSupplyAmount: string;
  minBorrowAmount: string;
  onMinSupplyChange: (value: string) => void;
  onMinBorrowChange: (value: string) => void;
  loanAssetSymbol: string;
};

function SettingItem({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-grow flex-col gap-1 pr-3">
        <h4 className="font-zen text-base font-medium text-primary">{title}</h4>
        <p className="font-zen text-xs text-secondary">{description}</p>
      </div>
      <div className="flex-shrink-0 pt-1">{children}</div>
    </div>
  );
}

export default function TransactionFiltersModal({
  isOpen,
  onOpenChange,
  minSupplyAmount,
  minBorrowAmount,
  onMinSupplyChange,
  onMinBorrowChange,
  loanAssetSymbol,
}: TransactionFiltersModalProps) {
  const handleSupplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Allow decimals and empty string
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onMinSupplyChange(value);
    }
  };

  const handleBorrowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Allow decimals and empty string
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onMinBorrowChange(value);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" size="xl" zIndex="settings">
      {(onClose) => (
        <>
          <ModalHeader
            title="Transaction Filters"
            description="Filter transactions by minimum amount"
            mainIcon={<FiSliders className="h-5 w-5" />}
            onClose={onClose}
          />
          <ModalBody className="flex flex-col gap-5">
            <div className="bg-surface-soft flex flex-col gap-4 rounded p-4">
              <h3 className="text-xs uppercase text-secondary">Minimum Amounts</h3>
              <p className="-mt-3 mb-1 text-xs text-secondary">
                Filter transactions to show only those above the specified minimum amount.
              </p>
              <SettingItem
                title={`Min Supply/Withdraw Amount (${loanAssetSymbol})`}
                description="Only show supply and withdraw transactions above this amount."
              >
                <Input
                  aria-label="Minimum supply amount"
                  placeholder="0"
                  value={minSupplyAmount}
                  onChange={handleSupplyChange}
                  size="sm"
                  type="text"
                  inputMode="decimal"
                  className="w-28"
                  classNames={{ input: 'text-right' }}
                />
              </SettingItem>
              <Divider />
              <SettingItem
                title={`Min Borrow/Repay Amount (${loanAssetSymbol})`}
                description="Only show borrow and repay transactions above this amount."
              >
                <Input
                  aria-label="Minimum borrow amount"
                  placeholder="0"
                  value={minBorrowAmount}
                  onChange={handleBorrowChange}
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
            <Button variant="light" onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

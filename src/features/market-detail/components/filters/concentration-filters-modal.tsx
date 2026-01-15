import { Input } from '@/components/ui/input';
import { GoFilter } from 'react-icons/go';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { SettingItem, createNumericInputHandler } from './shared-filter-utils';

type ConcentrationFiltersModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  minPercent: string;
  onMinPercentChange: (value: string) => void;
  title: string;
};

export default function ConcentrationFiltersModal({
  isOpen,
  onOpenChange,
  minPercent,
  onMinPercentChange,
  title,
}: ConcentrationFiltersModalProps) {
  const handlePercentChange = createNumericInputHandler(onMinPercentChange);

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
            title={`${title} Filters`}
            description="Filter positions by minimum percentage of total"
            mainIcon={<GoFilter className="h-5 w-5" />}
            onClose={onClose}
          />
          <ModalBody className="flex flex-col gap-5">
            <div className="bg-surface-soft flex flex-col gap-4 rounded p-4">
              <h3 className="text-xs uppercase text-secondary">Dust Threshold</h3>
              <p className="-mt-3 mb-1 text-xs text-secondary">
                Filter out small positions below the specified percentage of total market.
              </p>
              <SettingItem
                title="Minimum Position Size (%)"
                description="Only show positions with at least this percentage of total market value."
              >
                <Input
                  aria-label="Minimum percentage"
                  placeholder="0.01"
                  value={minPercent}
                  onChange={handlePercentChange}
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

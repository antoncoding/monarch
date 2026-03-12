import { FiSliders } from 'react-icons/fi';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import {
  BORROWER_TABLE_COLUMN_DESCRIPTIONS,
  BORROWER_TABLE_COLUMN_LABELS,
  type BorrowerTableColumnVisibility,
} from './borrower-table-column-visibility';

type BorrowerTableSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  columnVisibility: BorrowerTableColumnVisibility;
  onColumnVisibilityChange: (
    visibilityOrUpdater: BorrowerTableColumnVisibility | ((prev: BorrowerTableColumnVisibility) => BorrowerTableColumnVisibility),
  ) => void;
};

export function BorrowerTableSettingsModal({
  isOpen,
  onOpenChange,
  columnVisibility,
  onColumnVisibilityChange,
}: BorrowerTableSettingsModalProps) {
  const columnKeys = Object.keys(BORROWER_TABLE_COLUMN_LABELS) as (keyof BorrowerTableColumnVisibility)[];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      size="md"
      zIndex="settings"
    >
      {(onClose) => (
        <>
          <ModalHeader
            title="Table Preferences"
            description="Configure borrower table columns"
            mainIcon={<FiSliders className="h-5 w-5" />}
            onClose={onClose}
          />
          <ModalBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-4">
              <h3 className="text-xs uppercase text-secondary">Visible Columns</h3>
              <div className="flex flex-col gap-1">
                {columnKeys.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 py-1"
                  >
                    <label
                      htmlFor={`borrower-col-${key}`}
                      className="flex-grow cursor-pointer"
                    >
                      <p className="text-sm font-medium text-primary">{BORROWER_TABLE_COLUMN_LABELS[key]}</p>
                      <p className="text-xs text-secondary">{BORROWER_TABLE_COLUMN_DESCRIPTIONS[key]}</p>
                    </label>
                    <IconSwitch
                      id={`borrower-col-${key}`}
                      selected={columnVisibility[key]}
                      onChange={(value) => onColumnVisibilityChange((prev) => ({ ...prev, [key]: value }))}
                      size="xs"
                      color="primary"
                      aria-label={`Toggle ${BORROWER_TABLE_COLUMN_LABELS[key]} column`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}

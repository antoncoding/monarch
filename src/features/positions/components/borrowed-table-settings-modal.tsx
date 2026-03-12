import { FiSliders } from 'react-icons/fi';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import {
  BORROWED_TABLE_COLUMN_DESCRIPTIONS,
  BORROWED_TABLE_COLUMN_LABELS,
  DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
  type BorrowedTableColumnVisibility,
} from './borrowed-table-column-visibility';

type BorrowedTableSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  columnVisibility: BorrowedTableColumnVisibility;
  onColumnVisibilityChange: (
    visibilityOrUpdater: BorrowedTableColumnVisibility | ((prev: BorrowedTableColumnVisibility) => BorrowedTableColumnVisibility),
  ) => void;
};

export function BorrowedTableSettingsModal({
  isOpen,
  onOpenChange,
  columnVisibility,
  onColumnVisibilityChange,
}: BorrowedTableSettingsModalProps) {
  const columnKeys = Object.keys(BORROWED_TABLE_COLUMN_LABELS) as (keyof BorrowedTableColumnVisibility)[];

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
            description="Configure borrowed markets table columns"
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
                      htmlFor={`borrowed-col-${key}`}
                      className="flex-grow cursor-pointer"
                    >
                      <p className="text-sm font-medium text-primary">{BORROWED_TABLE_COLUMN_LABELS[key]}</p>
                      <p className="text-xs text-secondary">{BORROWED_TABLE_COLUMN_DESCRIPTIONS[key]}</p>
                    </label>
                    <IconSwitch
                      id={`borrowed-col-${key}`}
                      selected={columnVisibility[key] ?? DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY[key]}
                      onChange={(value) => onColumnVisibilityChange((prev) => ({ ...prev, [key]: value }))}
                      size="xs"
                      color="primary"
                      aria-label={`Toggle ${BORROWED_TABLE_COLUMN_LABELS[key]} column`}
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

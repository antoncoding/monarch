import type { ReactNode } from 'react';
import { FiSliders } from 'react-icons/fi';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import {
  BORROWER_TABLE_COLUMN_DESCRIPTIONS,
  BORROWER_TABLE_COLUMN_LABELS,
  DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
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

type SettingItemProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function SettingItem({ title, description, children }: SettingItemProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <h4 className="text-sm font-medium text-primary">{title}</h4>
        <p className="text-xs text-secondary">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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
                  <SettingItem
                    key={key}
                    title={BORROWER_TABLE_COLUMN_LABELS[key]}
                    description={BORROWER_TABLE_COLUMN_DESCRIPTIONS[key]}
                  >
                    <IconSwitch
                      id={`borrower-col-${key}`}
                      selected={columnVisibility[key] ?? DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY[key]}
                      onChange={(value) => onColumnVisibilityChange((prev) => ({ ...prev, [key]: value }))}
                      size="xs"
                      color="primary"
                      aria-label={`Toggle ${BORROWER_TABLE_COLUMN_LABELS[key]} column`}
                    />
                  </SettingItem>
                ))}
              </div>
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}

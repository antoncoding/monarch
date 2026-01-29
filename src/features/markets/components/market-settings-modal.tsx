import { useState, type ReactNode } from 'react';
import { FiSliders } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Input } from '@/components/ui/input';
import { Modal, ModalBody, ModalHeader, type ModalZIndex } from '@/components/common/Modal';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { COLUMN_DESCRIPTIONS, COLUMN_LABELS, DEFAULT_COLUMN_VISIBILITY, type ColumnVisibility } from './column-visibility';

type MarketSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  zIndex?: ModalZIndex;
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

export default function MarketSettingsModal({ isOpen, onOpenChange, zIndex = 'settings' }: MarketSettingsModalProps) {
  const { columnVisibility, setColumnVisibility, entriesPerPage, setEntriesPerPage } = useMarketPreferences();
  const { short: rateShort } = useRateLabel();

  const [customEntries, setCustomEntries] = useState(entriesPerPage.toString());

  const rateWord = rateShort === 'APR' ? 'rate' : 'yield';

  const getLabel = (key: keyof ColumnVisibility): string => {
    if (key === 'supplyAPY') return `Supply ${rateShort}`;
    if (key === 'borrowAPY') return `Borrow ${rateShort}`;
    return COLUMN_LABELS[key];
  };

  const getDescription = (key: keyof ColumnVisibility): string => {
    if (key === 'supplyAPY') return `Annual percentage ${rateWord} for suppliers`;
    if (key === 'borrowAPY') return `Annual percentage ${rateWord} for borrowers`;
    return COLUMN_DESCRIPTIONS[key];
  };

  const handleCustomEntriesSubmit = () => {
    const value = Number(customEntries);
    if (!Number.isNaN(value) && value > 0) {
      setEntriesPerPage(value);
    }
    setCustomEntries(value > 0 ? String(value) : entriesPerPage.toString());
  };

  const columnKeys = Object.keys(COLUMN_LABELS) as (keyof ColumnVisibility)[];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      size="md"
      zIndex={zIndex}
    >
      {(onClose) => (
        <>
          <ModalHeader
            title="Table Preferences"
            description="Configure column visibility and pagination"
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
                      htmlFor={`col-${key}`}
                      className="flex-grow cursor-pointer"
                    >
                      <p className="text-sm font-medium text-primary">{getLabel(key)}</p>
                      <p className="text-xs text-secondary">{getDescription(key)}</p>
                    </label>
                    <IconSwitch
                      id={`col-${key}`}
                      selected={columnVisibility[key] ?? DEFAULT_COLUMN_VISIBILITY[key] ?? false}
                      onChange={(value) => setColumnVisibility((prev) => ({ ...prev, [key]: value }))}
                      size="xs"
                      color="primary"
                      aria-label={`Toggle ${COLUMN_LABELS[key]} column`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs uppercase text-secondary">Pagination</h3>
              <SettingItem
                title="Entries Per Page"
                description="Number of markets shown on each page."
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Entries per page"
                    type="number"
                    placeholder="12"
                    value={customEntries}
                    onChange={(e) => setCustomEntries(e.target.value)}
                    min="1"
                    size="sm"
                    className="w-24"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomEntriesSubmit()}
                  />
                  <Button
                    size="sm"
                    onClick={handleCustomEntriesSubmit}
                  >
                    Update
                  </Button>
                </div>
              </SettingItem>
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}

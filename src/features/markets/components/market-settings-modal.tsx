import React from 'react';
import { Divider } from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { FiSliders } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { TrustedByCell } from '@/features/autovault/components/trusted-vault-badges';
import { useModal } from '@/hooks/useModal';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { type ColumnVisibility, COLUMN_LABELS, COLUMN_DESCRIPTIONS, DEFAULT_COLUMN_VISIBILITY } from './column-visibility';

type MarketSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
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

export default function MarketSettingsModal({ isOpen, onOpenChange }: MarketSettingsModalProps) {
  // Subscribe to Zustand stores directly - no prop drilling!
  const {
    columnVisibility,
    setColumnVisibility,
    entriesPerPage,
    setEntriesPerPage,
    usdMinSupply,
    setUsdMinSupply,
    usdMinBorrow,
    setUsdMinBorrow,
    usdMinLiquidity,
    setUsdMinLiquidity,
  } = useMarketPreferences();

  const [customEntries, setCustomEntries] = React.useState(entriesPerPage.toString());
  const { vaults: userTrustedVaults } = useTrustedVaults();
  const totalVaults = userTrustedVaults.length;
  const { showFullRewardAPY, setShowFullRewardAPY } = useAppSettings();
  const { open: openModal } = useModal();

  const handleCustomEntriesSubmit = () => {
    const value = Number(customEntries);
    if (!Number.isNaN(value) && value > 0) {
      setEntriesPerPage(value);
    }
    setCustomEntries(value > 0 ? String(value) : entriesPerPage.toString());
  };

  const handleUsdFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (/^\d*$/.test(value)) {
      // Update the corresponding store value
      if (name === 'minSupply') setUsdMinSupply(value);
      else if (name === 'minBorrow') setUsdMinBorrow(value);
      else if (name === 'minLiquidity') setUsdMinLiquidity(value);
    }
  };

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
            title="Market Preferences"
            description="Fine-tune filter thresholds, pagination, and column visibility"
            mainIcon={<FiSliders className="h-5 w-5" />}
            onClose={onClose}
          />
          <ModalBody className="flex flex-col gap-5">
            <div className="bg-surface-soft flex flex-col gap-4 rounded p-4">
              <h3 className="text-xs uppercase text-secondary">Filter Thresholds</h3>
              <p className="-mt-3 mb-1 text-xs text-secondary">
                Edit the numbers that power the Filters modal. Enable or disable filters directly from the Filters button on the markets
                page.
              </p>
              <SettingItem
                title="Min Supply (USD)"
                description="Only show markets where supplied assets meet this threshold."
              >
                <Input
                  aria-label="Minimum supply value"
                  name="minSupply"
                  placeholder="0"
                  value={usdMinSupply}
                  onChange={handleUsdFilterChange}
                  size="sm"
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className="w-28"
                  classNames={{ input: 'text-right' }}
                  startContent={<span className="text-small text-primary">$</span>}
                />
              </SettingItem>
              <Divider />
              <SettingItem
                title="Min Borrow (USD)"
                description="Only show markets where borrowed assets meet this threshold."
              >
                <Input
                  aria-label="Minimum borrow value"
                  name="minBorrow"
                  placeholder="0"
                  value={usdMinBorrow}
                  onChange={handleUsdFilterChange}
                  size="sm"
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className="w-28"
                  classNames={{ input: 'text-right' }}
                  startContent={<span className="text-small text-primary">$</span>}
                />
              </SettingItem>
              <Divider />
              <SettingItem
                title="Min Liquidity (USD)"
                description="Only show markets where available liquidity meets this threshold."
              >
                <Input
                  aria-label="Minimum liquidity value"
                  name="minLiquidity"
                  placeholder="0"
                  value={usdMinLiquidity}
                  onChange={handleUsdFilterChange}
                  size="sm"
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className="w-28"
                  classNames={{ input: 'text-right' }}
                  startContent={<span className="text-small text-primary">$</span>}
                />
              </SettingItem>
            </div>

            <div className="bg-surface-soft flex flex-col gap-3 rounded p-4">
              <h3 className="text-xs uppercase text-secondary">Visible Columns</h3>
              <p className="text-xs text-secondary mb-2">Choose which columns to display.</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(COLUMN_LABELS) as (keyof ColumnVisibility)[]).map((key) => {
                  const isVisible = columnVisibility[key] ?? DEFAULT_COLUMN_VISIBILITY[key] ?? false;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 rounded p-2 bg-surface hover:bg-surface-dark transition-colors"
                    >
                      <label
                        htmlFor={`col-${key}`}
                        className="flex-grow cursor-pointer"
                      >
                        <p className="text-sm font-medium text-primary">{COLUMN_LABELS[key]}</p>
                        <p className="text-xs text-secondary">{COLUMN_DESCRIPTIONS[key]}</p>
                      </label>
                      <IconSwitch
                        id={`col-${key}`}
                        selected={isVisible}
                        onChange={(value) =>
                          setColumnVisibility((prev) => ({
                            ...prev,
                            [key]: value,
                          }))
                        }
                        size="xs"
                        color="primary"
                        aria-label={`Toggle ${COLUMN_LABELS[key]} column`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-surface-soft flex flex-col gap-3 rounded p-4">
              <h3 className="text-xs uppercase text-secondary">View Options</h3>
              <SettingItem
                title="Show Full Reward APY"
                description="Include external rewards when displaying APY."
              >
                <IconSwitch
                  selected={showFullRewardAPY}
                  onChange={setShowFullRewardAPY}
                  size="xs"
                  color="primary"
                  aria-label="Toggle full reward APY"
                />
              </SettingItem>
              <Divider />
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 pr-4">
                    <h4 className="font-zen text-base font-medium text-primary">Trusted Vaults</h4>
                    <p className="font-zen text-xs text-secondary">Vaults that power the "Trusted By" column and filters.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openModal('monarchSettings', { initialCategory: 'vaults' })}
                    className="flex-shrink-0"
                  >
                    Manage
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <TrustedByCell
                    vaults={userTrustedVaults}
                    badgeSize={26}
                  />
                  <span className="text-xs text-secondary">{totalVaults} total</span>
                </div>
              </div>
              <Divider />
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

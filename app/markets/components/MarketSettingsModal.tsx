import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Divider,
} from '@heroui/react';
import { useMarkets } from '@/hooks/useMarkets';
import { ColumnVisibility, COLUMN_LABELS, COLUMN_DESCRIPTIONS } from './columnVisibility';
import { IconSwitch } from '@/components/common/IconSwitch';
import { Button } from '@/components/common';

type MarketSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: () => void;
  // Unknown Filters
  includeUnknownTokens: boolean;
  setIncludeUnknownTokens: (value: boolean) => void;
  showUnknownOracle: boolean;
  setShowUnknownOracle: (value: boolean) => void;
  // USD Filters (with enabled/disabled states)
  usdFilters: {
    minSupply: string;
    minBorrow: string;
    minLiquidity: string;
  };
  setUsdFilters: (filters: MarketSettingsModalProps['usdFilters']) => void;
  // USD Filter enabled states
  minSupplyEnabled: boolean;
  setMinSupplyEnabled: (value: boolean) => void;
  minBorrowEnabled: boolean;
  setMinBorrowEnabled: (value: boolean) => void;
  minLiquidityEnabled: boolean;
  setMinLiquidityEnabled: (value: boolean) => void;
  // Pagination
  entriesPerPage: number;
  onEntriesPerPageChange: (value: number) => void;
  // Column Visibility
  columnVisibility: ColumnVisibility;
  setColumnVisibility: (visibility: ColumnVisibility) => void;
};

// Reusable component for consistent setting layout
function SettingItem({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-grow flex-col gap-1 pr-2">
        <h4 className="text-base font-medium text-primary">{title}</h4>
        <p className="text-xs text-secondary">{description}</p>
      </div>
      <div className="flex-shrink-0 pt-1">
        {' '}
        {/* Align control slightly lower */}
        {children}
      </div>
    </div>
  );
}

export default function MarketSettingsModal({
  isOpen,
  onOpenChange,
  includeUnknownTokens,
  setIncludeUnknownTokens,
  showUnknownOracle,
  setShowUnknownOracle,
  usdFilters,
  setUsdFilters,
  minSupplyEnabled,
  setMinSupplyEnabled,
  minBorrowEnabled,
  setMinBorrowEnabled,
  minLiquidityEnabled,
  setMinLiquidityEnabled,
  entriesPerPage,
  onEntriesPerPageChange,
  columnVisibility,
  setColumnVisibility,
}: MarketSettingsModalProps) {
  const [customEntries, setCustomEntries] = React.useState(entriesPerPage.toString());
  const {
    showUnwhitelistedMarkets,
    setShowUnwhitelistedMarkets,
    showFullRewardAPY,
    setShowFullRewardAPY,
  } = useMarkets();

  const handleEntriesChange = (value: number) => {
    onEntriesPerPageChange(value);
    setCustomEntries(value.toString()); // Update local state if preset is clicked
  };

  const handleCustomEntriesSubmit = () => {
    const value = parseInt(customEntries, 10);
    if (!isNaN(value) && value > 0) {
      onEntriesPerPageChange(value);
    } else {
      setCustomEntries(entriesPerPage.toString());
    }
  };

  const handleUsdFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (/^\d*$/.test(value)) {
      setUsdFilters({
        ...usdFilters,
        [name]: value,
      });
    }
  };


  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      size="xl"
      classNames={{
        wrapper: 'z-[2300]',
        backdrop: 'z-[2290]',
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 font-zen">Market View Settings</ModalHeader>
            <ModalBody className="flex flex-col gap-5 px-4 pb-6 pt-2 md:px-6 max-h-[70vh] overflow-y-auto">
              {/* --- Filter Settings Section --- */}
              <div className="bg-surface-soft flex flex-col gap-4 rounded p-4">
                {/* Section Header: Adjusted style & position */}
                <h3 className="mb-1 font-zen text-xs uppercase text-secondary">Filter Settings</h3>
                <SettingItem
                  title="Show Unknown Tokens"
                  description="Display tokens not in the recognized list (marked with '?'). Use with caution."
                >
                  <IconSwitch
                    selected={includeUnknownTokens}
                    onChange={setIncludeUnknownTokens}
                    size="xs"
                    color="primary"
                    aria-label="Toggle unknown tokens"
                  />
                </SettingItem>
                <Divider />
                <SettingItem
                  title="Show Unknown Oracles"
                  description="Display markets using unverified oracles. Use with caution."
                >
                  <IconSwitch
                    selected={showUnknownOracle}
                    onChange={setShowUnknownOracle}
                    size="xs"
                    color="primary"
                    aria-label="Toggle unknown oracles"
                  />
                </SettingItem>
                <Divider />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-grow flex-col gap-1 pr-2">
                    <h4 className="text-base font-medium text-red-600 dark:text-red-400">
                      Show Unwhitelisted Markets
                    </h4>
                    <p className="text-xs text-secondary">
                      Display markets that haven't been verified or whitelisted. These may have
                      additional risks.
                    </p>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    <IconSwitch
                      selected={showUnwhitelistedMarkets}
                      onChange={setShowUnwhitelistedMarkets}
                      size="xs"
                      color="destructive"
                      aria-label="Toggle unwhitelisted markets"
                    />
                  </div>
                </div>
              </div>

              {/* --- USD Value Filters Section --- */}
              <div className="bg-surface-soft flex flex-col gap-4 rounded p-4">
                {/* Section Header: Adjusted style & position */}
                <h3 className="mb-1 font-zen text-xs uppercase text-secondary">
                  Filter by Min USD Value
                </h3>
                <p className="-mt-3 mb-1 text-xs text-warning">
                  Note: USD values are estimates and may not be available or accurate for all
                  markets. Toggle the switch to enable/disable each filter.
                </p>
                {/* Min Supply Filter */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <h4
                      className={`text-base font-medium ${
                        minSupplyEnabled ? 'text-primary' : 'text-secondary'
                      }`}
                    >
                      Min Supply (USD)
                    </h4>
                    <IconSwitch
                      selected={minSupplyEnabled}
                      onChange={setMinSupplyEnabled}
                      size="xs"
                      color="primary"
                      aria-label="Toggle minimum supply filter"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <p className="flex-1 text-xs text-secondary">
                      Only show markets where total supplied assets meet or exceed this threshold.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label="Minimum supply value"
                        name="minSupply"
                        placeholder="0"
                        value={usdFilters.minSupply}
                        onChange={handleUsdFilterChange}
                        isDisabled={!minSupplyEnabled}
                        size="sm"
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        className="w-24 sm:w-28"
                        classNames={{ input: 'text-right' }}
                        startContent={
                          <div className="pointer-events-none flex items-center">
                            <span
                              className={`text-small ${
                                minSupplyEnabled && usdFilters.minSupply ? 'text-primary' : 'text-default-400'
                              }`}
                            >
                              $
                            </span>
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
                <Divider />

                {/* Min Borrow Filter */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <h4
                      className={`text-base font-medium ${
                        minBorrowEnabled ? 'text-primary' : 'text-secondary'
                      }`}
                    >
                      Min Borrow (USD)
                    </h4>
                    <IconSwitch
                      selected={minBorrowEnabled}
                      onChange={setMinBorrowEnabled}
                      size="xs"
                      color="primary"
                      aria-label="Toggle minimum borrow filter"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <p className="flex-1 text-xs text-secondary">
                      Only show markets where borrowed assets meet or exceed this threshold.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label="Minimum borrow value"
                        name="minBorrow"
                        placeholder="0"
                        value={usdFilters.minBorrow}
                        onChange={handleUsdFilterChange}
                        isDisabled={!minBorrowEnabled}
                        size="sm"
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        className="w-24 sm:w-28"
                        classNames={{ input: 'text-right' }}
                        startContent={
                          <div className="pointer-events-none flex items-center">
                            <span
                              className={`text-small ${
                                minBorrowEnabled && usdFilters.minBorrow ? 'text-primary' : 'text-default-400'
                              }`}
                            >
                              $
                            </span>
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
                <Divider />

                {/* Min Liquidity Filter */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <h4
                      className={`text-base font-medium ${
                        minLiquidityEnabled ? 'text-primary' : 'text-secondary'
                      }`}
                    >
                      Min Liquidity (USD)
                    </h4>
                    <IconSwitch
                      selected={minLiquidityEnabled}
                      onChange={setMinLiquidityEnabled}
                      size="xs"
                      color="primary"
                      aria-label="Toggle minimum liquidity filter"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <p className="flex-1 text-xs text-secondary">
                      Only show markets where available liquidity meets or exceeds this threshold.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label="Minimum liquidity value"
                        name="minLiquidity"
                        placeholder="0"
                        value={usdFilters.minLiquidity}
                        onChange={handleUsdFilterChange}
                        isDisabled={!minLiquidityEnabled}
                        size="sm"
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        className="w-24 sm:w-28"
                        classNames={{ input: 'text-right' }}
                        startContent={
                          <div className="pointer-events-none flex items-center">
                            <span
                              className={`text-small ${
                                minLiquidityEnabled && usdFilters.minLiquidity ? 'text-primary' : 'text-default-400'
                              }`}
                            >
                              $
                            </span>
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Column Visibility Section --- */}
              <div className="bg-surface-soft flex flex-col gap-3 rounded p-4">
                <h3 className="mb-1 font-zen text-xs uppercase text-secondary">
                  Visible Columns
                </h3>
                <p className="text-xs text-secondary mb-2">
                  Choose which columns to display in the markets table.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(columnVisibility) as (keyof ColumnVisibility)[]).map((key) => (
                    <div key={key} className="flex items-center justify-between gap-2 rounded p-2 bg-surface hover:bg-surface-dark transition-colors">
                      <label htmlFor={`col-${key}`} className="flex-grow cursor-pointer">
                        <p className="text-sm font-medium text-primary">{COLUMN_LABELS[key]}</p>
                        <p className="text-xs text-secondary">{COLUMN_DESCRIPTIONS[key]}</p>
                      </label>
                      <IconSwitch
                        id={`col-${key}`}
                        selected={columnVisibility[key]}
                        onChange={(value) =>
                          setColumnVisibility({ ...columnVisibility, [key]: value })
                        }
                        size="xs"
                        color="primary"
                        aria-label={`Toggle ${COLUMN_LABELS[key]} column`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* --- View Options Section --- */}
              <div className="bg-surface-soft flex flex-col gap-3 rounded p-4">
                {/* Section Header: Adjusted style & position */}
                <h3 className="mb-1 font-zen text-xs uppercase text-secondary">View Options</h3>

                {/* Full Reward APY Setting */}
                <SettingItem
                  title="Show Full Reward APY"
                  description="Display total APY including base rate plus external reward campaigns (instead of base APY only)."
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

                {/* Pagination Settings */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-base font-medium text-primary">Entries Per Page</h4>
                      <p className="text-xs text-secondary">
                        Choose how many markets appear per page in the table.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {[8, 10, 15].map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          onPress={() => handleEntriesChange(value)}
                          variant={entriesPerPage === value ? 'cta' : 'secondary'}
                          className="min-w-[40px] shadow-sm"
                        >
                          {value}
                        </Button>
                      ))}
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Custom entries per page"
                          type="number"
                          placeholder="Custom"
                          value={customEntries}
                          onChange={(e) => setCustomEntries(e.target.value)}
                          min="1"
                          size="sm"
                          className="w-20"
                          onKeyDown={(e) => e.key === 'Enter' && handleCustomEntriesSubmit()}
                        />
                        <Button size="sm" onPress={handleCustomEntriesSubmit} variant="flat">
                          Set
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

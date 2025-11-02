import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Input,
  Divider,
} from '@heroui/react';
import { useMarkets } from '@/hooks/useMarkets';

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
            <ModalBody className="flex flex-col gap-5 px-4 pb-6 pt-2 md:px-6">
              {/* --- Filter Settings Section --- */}
              <div className="bg-surface-soft flex flex-col gap-4 rounded p-4">
                {/* Section Header: Adjusted style & position */}
                <h3 className="mb-1 font-zen text-xs uppercase text-secondary">Filter Settings</h3>
                <SettingItem
                  title="Show Unknown Tokens"
                  description="Display tokens not in the recognized list (marked with '?'). Use with caution."
                >
                  <Switch
                    isSelected={includeUnknownTokens}
                    onValueChange={setIncludeUnknownTokens}
                    size="sm"
                    color="primary"
                  />
                </SettingItem>
                <Divider />
                <SettingItem
                  title="Show Unknown Oracles"
                  description="Display markets using unverified oracles. Use with caution."
                >
                  <Switch
                    isSelected={showUnknownOracle}
                    onValueChange={setShowUnknownOracle}
                    size="sm"
                    color="primary"
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
                    <Switch
                      isSelected={showUnwhitelistedMarkets}
                      onValueChange={setShowUnwhitelistedMarkets}
                      size="sm"
                      color="danger"
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-grow flex-col gap-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        isSelected={minSupplyEnabled}
                        onValueChange={setMinSupplyEnabled}
                        size="sm"
                        color="primary"
                      />
                      <h4 className={`text-base font-medium ${minSupplyEnabled ? 'text-primary' : 'text-secondary'}`}>
                        Min Supply (USD)
                      </h4>
                    </div>
                    <p className="text-xs text-secondary">
                      Show markets with total supply &gt;= this value. This filter can also be toggled from the main page.
                    </p>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    <Input
                      aria-label="Minimum Supply in USD"
                      name="minSupply"
                      placeholder="0"
                      value={usdFilters.minSupply}
                      onChange={handleUsdFilterChange}
                      isDisabled={!minSupplyEnabled}
                      size="sm"
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      className="max-w-[120px]"
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
                <Divider />

                {/* Min Borrow Filter */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-grow flex-col gap-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        isSelected={minBorrowEnabled}
                        onValueChange={setMinBorrowEnabled}
                        size="sm"
                        color="primary"
                      />
                      <h4 className={`text-base font-medium ${minBorrowEnabled ? 'text-primary' : 'text-secondary'}`}>
                        Min Borrow (USD)
                      </h4>
                    </div>
                    <p className="text-xs text-secondary">
                      Show markets with total borrow &gt;= this value.
                    </p>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    <Input
                      aria-label="Minimum Borrow in USD"
                      name="minBorrow"
                      placeholder="0"
                      value={usdFilters.minBorrow}
                      onChange={handleUsdFilterChange}
                      isDisabled={!minBorrowEnabled}
                      size="sm"
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      className="max-w-[120px]"
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
                <Divider />

                {/* Min Liquidity Filter */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-grow flex-col gap-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        isSelected={minLiquidityEnabled}
                        onValueChange={setMinLiquidityEnabled}
                        size="sm"
                        color="primary"
                      />
                      <h4 className={`text-base font-medium ${minLiquidityEnabled ? 'text-primary' : 'text-secondary'}`}>
                        Min Liquidity (USD)
                      </h4>
                    </div>
                    <p className="text-xs text-secondary">
                      Show markets with available liquidity &gt;= this value.
                    </p>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    <Input
                      aria-label="Minimum Liquidity in USD"
                      name="minLiquidity"
                      placeholder="0"
                      value={usdFilters.minLiquidity}
                      onChange={handleUsdFilterChange}
                      isDisabled={!minLiquidityEnabled}
                      size="sm"
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      className="max-w-[120px]"
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

              {/* --- View Options Section --- */}
              <div className="bg-surface-soft flex flex-col gap-3 rounded p-4">
                {/* Section Header: Adjusted style & position */}
                <h3 className="mb-1 font-zen text-xs uppercase text-secondary">View Options</h3>

                {/* Full Reward APY Setting */}
                <SettingItem
                  title="Show Full Reward APY"
                  description="Display total APY including base rate plus external reward campaigns (instead of base APY only)."
                >
                  <Switch
                    isSelected={showFullRewardAPY}
                    onValueChange={setShowFullRewardAPY}
                    size="sm"
                    color="primary"
                  />
                </SettingItem>
                <Divider />

                {/* Pagination Settings */}
                <p className="w-full text-left text-sm">Entries per page:</p>
                <div className="flex flex-row flex-wrap items-center justify-start gap-2">
                  {[8, 10, 15].map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      onPress={() => handleEntriesChange(value)}
                      variant={entriesPerPage === value ? 'solid' : 'bordered'}
                      color={entriesPerPage === value ? 'primary' : 'default'}
                      className={`min-w-[40px] ${
                        entriesPerPage === value ? '' : 'border-foreground-300 text-foreground-600'
                      }`}
                    >
                      {value}
                    </Button>
                  ))}
                  <div className="flex flex-grow items-center gap-2 sm:flex-grow-0">
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

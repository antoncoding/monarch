'use client';

import { useMemo, type ReactNode } from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Divider, Tooltip, useDisclosure } from '@heroui/react';
import { Button } from '@/components/common/Button';
import { FiFilter } from 'react-icons/fi';
import { IconSwitch } from '@/components/common/IconSwitch';
import { TooltipContent } from '@/components/TooltipContent';
import { formatReadable } from '@/utils/balance';

type SuppliedAssetFilterCompactSwitchProps = {
  includeUnknownTokens: boolean;
  setIncludeUnknownTokens: (value: boolean) => void;
  showUnknownOracle: boolean;
  setShowUnknownOracle: (value: boolean) => void;
  showUnwhitelistedMarkets: boolean;
  setShowUnwhitelistedMarkets: (value: boolean) => void;
  trustedVaultsOnly: boolean;
  setTrustedVaultsOnly: (value: boolean) => void;
  minSupplyEnabled: boolean;
  setMinSupplyEnabled: (value: boolean) => void;
  minBorrowEnabled: boolean;
  setMinBorrowEnabled: (value: boolean) => void;
  minLiquidityEnabled: boolean;
  setMinLiquidityEnabled: (value: boolean) => void;
  thresholds: {
    minSupply: number;
    minBorrow: number;
    minLiquidity: number;
  };
  onOpenSettings: () => void;
  className?: string;
};

export function SuppliedAssetFilterCompactSwitch({
  includeUnknownTokens,
  setIncludeUnknownTokens,
  showUnknownOracle,
  setShowUnknownOracle,
  showUnwhitelistedMarkets,
  setShowUnwhitelistedMarkets,
  trustedVaultsOnly,
  setTrustedVaultsOnly,
  minSupplyEnabled,
  setMinSupplyEnabled,
  minBorrowEnabled,
  setMinBorrowEnabled,
  minLiquidityEnabled,
  setMinLiquidityEnabled,
  thresholds,
  onOpenSettings,
  className,
}: SuppliedAssetFilterCompactSwitchProps) {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();

  const thresholdCopy = useMemo(
    () => ({
      minSupply: formatReadable(thresholds.minSupply),
      minBorrow: formatReadable(thresholds.minBorrow),
      minLiquidity: formatReadable(thresholds.minLiquidity),
    }),
    [thresholds],
  );

  const handleCustomize = () => {
    onClose();
    onOpenSettings();
  };

  const basicFilterActive = !includeUnknownTokens || !showUnknownOracle || !showUnwhitelistedMarkets;
  const advancedFilterActive = trustedVaultsOnly || minSupplyEnabled || minBorrowEnabled || minLiquidityEnabled;
  const hasActiveFilters = basicFilterActive || advancedFilterActive;

  return (
    <div className={className}>
      <Tooltip
        classNames={{
          base: 'p-0 m-0 bg-transparent shadow-sm border-none',
          content: 'p-0 m-0 bg-transparent shadow-sm border-none',
        }}
        content={
          <TooltipContent
            title="Filters"
            detail="Toggle market filters and risk guards"
            secondaryDetail="Use the gear icon to fine-tune settings"
            icon={<FiFilter size={14} />}
          />
        }
      >
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className={`min-w-0 px-2 ${hasActiveFilters ? 'text-monarch-orange' : 'text-secondary'}`}
          aria-label="Market filters"
          onPress={onOpen}
        >
          <FiFilter size={14} />
        </Button>
      </Tooltip>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-1 font-zen">
                Filters
                <p className="text-xs font-normal text-secondary">
                  Quickly toggle the visibility filters that power the markets table.
                </p>
              </ModalHeader>
              <ModalBody className="flex flex-col gap-5">
                <FilterSection title="Basic Filters">
                  <FilterRow
                    title="Show Unknown Tokens"
                    description="Display tokens outside of the curated list."
                  >
                    <IconSwitch selected={includeUnknownTokens} onChange={setIncludeUnknownTokens} size="xs" />
                  </FilterRow>
                  <FilterRow
                    title="Show Unknown Oracles"
                    description="Include markets with unverified oracle feeds."
                  >
                    <IconSwitch selected={showUnknownOracle} onChange={setShowUnknownOracle} size="xs" />
                  </FilterRow>
                  <FilterRow
                    title="Show Unwhitelisted Markets"
                    description="Surface markets that haven't been vetted by Monarch."
                  >
                    <IconSwitch
                      selected={showUnwhitelistedMarkets}
                      onChange={setShowUnwhitelistedMarkets}
                      size="xs"
                      color="destructive"
                    />
                  </FilterRow>
                </FilterSection>

                <Divider />

                <FilterSection
                  title="Advanced Filters"
                  helper="Click the gear icon to adjust thresholds or manage trusted vaults."
                >
                  <FilterRow
                    title="Trusted Vaults Only"
                    description="Hide markets where none of your trusted vaults supply."
                  >
                    <div className="flex items-center gap-2">
                      <IconSwitch selected={trustedVaultsOnly} onChange={setTrustedVaultsOnly} size="xs" />
                    </div>
                  </FilterRow>
                  <FilterRow
                    title="Min Supply"
                    description={`Require ≥ $${thresholdCopy.minSupply} supplied.`}
                  >
                    <IconSwitch selected={minSupplyEnabled} onChange={setMinSupplyEnabled} size="xs" />
                  </FilterRow>
                  <FilterRow
                    title="Min Borrow"
                    description={`Require ≥ $${thresholdCopy.minBorrow} borrowed.`}
                  >
                    <IconSwitch selected={minBorrowEnabled} onChange={setMinBorrowEnabled} size="xs" />
                  </FilterRow>
                  <FilterRow
                    title="Min Liquidity"
                    description={`Require ≥ $${thresholdCopy.minLiquidity} liquidity.`}
                  >
                    <IconSwitch
                      selected={minLiquidityEnabled}
                      onChange={setMinLiquidityEnabled}
                      size="xs"
                    />
                  </FilterRow>
                </FilterSection>
              </ModalBody>
              <ModalFooter className="justify-between">
                <Button variant="flat" size="sm" onPress={handleCustomize}>
                  Customize Filters
                </Button>
                <Button color="primary" size="sm" onPress={close}>
                  Done
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function FilterSection({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="font-zen text-sm font-semibold text-primary">{title}</span>
        {helper && <span className="font-zen text-xs text-secondary">{helper}</span>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function FilterRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1 pr-4">
        <span className="font-zen text-sm font-medium text-primary">{title}</span>
        <span className="font-zen text-xs text-secondary">{description}</span>
      </div>
      <div className="pt-1">{children}</div>
    </div>
  );
}

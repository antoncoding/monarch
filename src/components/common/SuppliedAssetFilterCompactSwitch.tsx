'use client';

import { useMemo } from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Divider, Tooltip, useDisclosure } from '@heroui/react';
import { FiFilter } from 'react-icons/fi';
import { Button } from '@/components/common/Button';
import { FilterRow, FilterSection } from '@/components/common/FilterComponents';
import { IconSwitch } from '@/components/common/IconSwitch';
import { TooltipContent } from '@/components/TooltipContent';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
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

  const basicFilterActive = includeUnknownTokens || showUnknownOracle || showUnwhitelistedMarkets;
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
            icon={<FiFilter size={14} />}
          />
        }
      >
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="min-w-0 px-2 text-secondary"
          aria-label="Market filters"
          onPress={onOpen}
        >
          <FiFilter size={14} style={{ color: hasActiveFilters ? MONARCH_PRIMARY : undefined}} />
        </Button>
      </Tooltip>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="md"
        backdrop="opaque"
        classNames={{
          wrapper: 'z-[2400]',
          backdrop: 'z-[2390]',
        }}
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-1 font-zen px-6 pt-4">
                <span className="text-base font-normal text-primary">Filters</span>
                <span className="text-sm font-normal text-secondary">
                  Quickly toggle the visibility filters that power the markets table
                </span>
              </ModalHeader>
              <ModalBody className="flex flex-col gap-4 px-6 pb-4 pt-2 font-zen">
                <FilterSection 
                  title="Basic Filters" 
                  helper="Options to display markets with unknown parameters. Use with caution."
                >
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
                  helper="Use advanced filters to fine-tune your market view. Use Customize Filters to adjust thresholds and manage trusted vaults."
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

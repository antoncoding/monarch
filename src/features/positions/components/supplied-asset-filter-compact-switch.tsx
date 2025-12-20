'use client';

import { useMemo } from 'react';
import { useDisclosure } from '@/hooks/useDisclosure';
import { Divider } from '@/components/ui/divider';
import { Tooltip } from '@/components/ui/tooltip';
import { FiFilter } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { FilterRow, FilterSection } from '@/components/ui/filter-components';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { TooltipContent } from '@/components/shared/tooltip-content';
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
      <Tooltip        content={
          <TooltipContent
            title="Filters"
            detail="Toggle market filters and risk guards"
            icon={<FiFilter size={14} />}
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="min-w-0 px-2 text-secondary"
          aria-label="Market filters"
          onClick={onOpen}
        >
          <FiFilter
            size={14}
            style={{ color: hasActiveFilters ? MONARCH_PRIMARY : undefined }}
          />
        </Button>
      </Tooltip>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="md"
        backdrop="opaque"
        zIndex="settings"
      >
        {(close) => (
          <>
            <ModalHeader
              variant="compact"
              title="Filters"
              description="Quickly toggle the visibility filters that power the markets table"
              mainIcon={<FiFilter size={14} />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="flex flex-col gap-4"
            >
              <FilterSection
                title="Basic Filters"
                helper="Options to display markets with unknown parameters. Use with caution."
              >
                <FilterRow
                  title="Show Unknown Tokens"
                  description="Display tokens outside of the curated list."
                >
                  <IconSwitch
                    selected={includeUnknownTokens}
                    onChange={setIncludeUnknownTokens}
                    size="xs"
                  />
                </FilterRow>
                <FilterRow
                  title="Show Unknown Oracles"
                  description="Include markets with unverified oracle feeds."
                >
                  <IconSwitch
                    selected={showUnknownOracle}
                    onChange={setShowUnknownOracle}
                    size="xs"
                  />
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
                    <IconSwitch
                      selected={trustedVaultsOnly}
                      onChange={setTrustedVaultsOnly}
                      size="xs"
                    />
                  </div>
                </FilterRow>
                <FilterRow
                  title="Min Supply"
                  description={`Require ≥ $${thresholdCopy.minSupply} supplied.`}
                >
                  <IconSwitch
                    selected={minSupplyEnabled}
                    onChange={setMinSupplyEnabled}
                    size="xs"
                  />
                </FilterRow>
                <FilterRow
                  title="Min Borrow"
                  description={`Require ≥ $${thresholdCopy.minBorrow} borrowed.`}
                >
                  <IconSwitch
                    selected={minBorrowEnabled}
                    onChange={setMinBorrowEnabled}
                    size="xs"
                  />
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCustomize}
              >
                Customize Filters
              </Button>
              <Button
                color="primary"
                size="sm"
                onClick={close}
              >
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}

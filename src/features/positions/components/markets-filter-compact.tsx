'use client';

import { GoFilter, GoGear } from 'react-icons/go';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FilterRow, FilterSection } from '@/components/ui/filter-components';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Tooltip } from '@/components/ui/tooltip';
import { Modal, ModalBody, ModalFooter, ModalHeader, type ModalZIndex } from '@/components/common/Modal';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useModal } from '@/hooks/useModal';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { formatReadable } from '@/utils/balance';
import { parseNumericThreshold } from '@/utils/markets';

type MarketFilterProps = {
  className?: string;
  variant?: 'ghost' | 'button';
  zIndex?: ModalZIndex;
};

type DetailViewType = 'filter-thresholds' | 'trusted-vaults' | 'custom-tag-config';

export function MarketFilter({ className, variant = 'ghost', zIndex = 'settings' }: MarketFilterProps) {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const { open: openModal } = useModal();

  // Get all filter values from stores
  const {
    includeUnknownTokens,
    setIncludeUnknownTokens,
    showUnknownOracle,
    setShowUnknownOracle,
    showLockedMarkets,
    setShowLockedMarkets,
    trustedVaultsOnly,
    setTrustedVaultsOnly,
    minSupplyEnabled,
    setMinSupplyEnabled,
    minBorrowEnabled,
    setMinBorrowEnabled,
    minLiquidityEnabled,
    setMinLiquidityEnabled,
    usdMinSupply,
    usdMinBorrow,
    usdMinLiquidity,
    showOfficialTrending,
    customTagConfig,
  } = useMarketPreferences();

  const { trendingMode, toggleTrendingMode, customTagMode, toggleCustomTagMode } = useMarketsFilters();
  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useAppSettings();
  const { vaults: trustedVaults } = useTrustedVaults();
  const trustedVaultCount = trustedVaults.length;

  // Navigate to a specific detail view, then reopen filter when settings closes
  const handleOpenDetailView = (detailView: DetailViewType) => {
    onClose();
    openModal('monarchSettings', {
      initialDetailView: detailView,
      onCloseCallback: onOpen,
    });
  };

  const basicGuardianAllAllowed = includeUnknownTokens && showUnknownOracle && showUnwhitelistedMarkets && showLockedMarkets;
  const advancedFilterActive =
    trustedVaultsOnly || minSupplyEnabled || minBorrowEnabled || minLiquidityEnabled || trendingMode || customTagMode;
  const hasActiveFilters = advancedFilterActive || !basicGuardianAllAllowed;

  const isButtonVariant = variant === 'button';

  const formatThreshold = (value: string) => `>= $${formatReadable(parseNumericThreshold(value))}`;

  return (
    <div className={className}>
      <Tooltip
        content={
          <TooltipContent
            title="Filters"
            detail="Toggle market filters and risk guards"
            icon={<GoFilter size={14} />}
          />
        }
      >
        <Button
          variant={isButtonVariant ? 'default' : 'ghost'}
          size={isButtonVariant ? 'md' : 'sm'}
          className={isButtonVariant ? 'w-10 min-w-10 px-0' : 'min-w-0 px-2 text-secondary'}
          aria-label="Market filters"
          onClick={onOpen}
        >
          <GoFilter
            size={isButtonVariant ? 16 : 14}
            style={{ color: hasActiveFilters ? MONARCH_PRIMARY : undefined }}
          />
        </Button>
      </Tooltip>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="md"
        backdrop="opaque"
        zIndex={zIndex}
      >
        {(close) => (
          <>
            <ModalHeader
              variant="compact"
              title="Filters"
              description="Quickly toggle filters that control market visibility"
              mainIcon={<GoFilter size={14} />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="flex flex-col gap-4"
            >
              <FilterSection
                title="Risk Guards"
                helper="Control visibility of unverified markets and tokens."
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
                  description="Display markets not listed by Morpho."
                >
                  <IconSwitch
                    selected={showUnwhitelistedMarkets}
                    onChange={setShowUnwhitelistedMarkets}
                    size="xs"
                    color="destructive"
                  />
                </FilterRow>
                <FilterRow
                  title="Show Locked Markets"
                  description="Display frozen markets with extreme APY (> 1500%)."
                >
                  <IconSwitch
                    selected={showLockedMarkets}
                    onChange={setShowLockedMarkets}
                    size="xs"
                  />
                </FilterRow>
              </FilterSection>

              <Divider />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-zen text-sm font-semibold text-primary">Value Thresholds</span>
                    <span className="font-zen text-xs text-secondary">Filter markets by minimum USD values.</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDetailView('filter-thresholds')}
                    aria-label="Configure thresholds"
                    className="h-7 w-7"
                  >
                    <GoGear className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col gap-3">
                  <FilterRow
                    title="Min Supply"
                    description={formatThreshold(usdMinSupply)}
                  >
                    <IconSwitch
                      selected={minSupplyEnabled}
                      onChange={setMinSupplyEnabled}
                      size="xs"
                    />
                  </FilterRow>
                  <FilterRow
                    title="Min Borrow"
                    description={formatThreshold(usdMinBorrow)}
                  >
                    <IconSwitch
                      selected={minBorrowEnabled}
                      onChange={setMinBorrowEnabled}
                      size="xs"
                    />
                  </FilterRow>
                  <FilterRow
                    title="Min Liquidity"
                    description={formatThreshold(usdMinLiquidity)}
                  >
                    <IconSwitch
                      selected={minLiquidityEnabled}
                      onChange={setMinLiquidityEnabled}
                      size="xs"
                    />
                  </FilterRow>
                </div>
              </div>

              <Divider />

              <FilterSection
                title="My Preferences"
                helper="Filters based on your configured preferences."
              >
                <FilterRow
                  title="Trusted Vaults Only"
                  description={`Show markets supplied by your ${trustedVaultCount} trusted vault${trustedVaultCount !== 1 ? 's' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDetailView('trusted-vaults')}
                      aria-label="Configure trusted vaults"
                      className="h-6 w-6"
                    >
                      <GoGear className="h-3.5 w-3.5" />
                    </Button>
                    <IconSwitch
                      selected={trustedVaultsOnly}
                      onChange={setTrustedVaultsOnly}
                      size="xs"
                    />
                  </div>
                </FilterRow>
                {/* Official Trending Filter (backend-computed) */}
                {showOfficialTrending && (
                  <FilterRow
                    title="Trending Only"
                    description="Show officially trending markets"
                  >
                    <IconSwitch
                      selected={trendingMode}
                      onChange={toggleTrendingMode}
                      size="xs"
                      color="primary"
                    />
                  </FilterRow>
                )}
                {/* Custom Tag Filter (user-defined) */}
                {customTagConfig.enabled && (
                  <FilterRow
                    title="Custom Tag Only"
                    description="Show markets matching your custom tag"
                  >
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDetailView('custom-tag-config')}
                        aria-label="Configure custom tag"
                        className="h-6 w-6"
                      >
                        <GoGear className="h-3.5 w-3.5" />
                      </Button>
                      <IconSwitch
                        selected={customTagMode}
                        onChange={toggleCustomTagMode}
                        size="xs"
                        color="primary"
                      />
                    </div>
                  </FilterRow>
                )}
              </FilterSection>
            </ModalBody>
            <ModalFooter className="justify-end">
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

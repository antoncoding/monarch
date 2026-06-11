'use client';

import { useMemo } from 'react';
import { GoFilter, GoGear, GoShield, GoShieldCheck, GoStar } from 'react-icons/go';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FilterRow, FilterSection } from '@/components/ui/filter-components';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Tooltip } from '@/components/ui/tooltip';
import { Modal, ModalBody, ModalFooter, ModalHeader, type ModalZIndex } from '@/components/common/Modal';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { useDisclosure } from '@/hooks/useDisclosure';
import { type MarketFilterGuardStatus, useMarketFilterDependencyStatus } from '@/hooks/useMarketFilterDependencyStatus';
import { useModal } from '@/hooks/useModal';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { formatReadable } from '@/utils/balance';
import { parseNumericThreshold } from '@/utils/markets';

type MarketFilterProps = {
  className?: string;
  variant?: 'ghost' | 'button';
  zIndex?: ModalZIndex;
};

type DetailViewType = 'filter-thresholds' | 'custom-tag-config';

const isGuardAffected = (guard: MarketFilterGuardStatus | undefined): guard is MarketFilterGuardStatus =>
  Boolean(guard?.active && guard.readiness !== 'ready');

const getGuardDescription = (guard: MarketFilterGuardStatus | undefined, fallback: string) => {
  return isGuardAffected(guard) ? guard.impact : fallback;
};

function GuardStatusBadge({ guard }: { guard: MarketFilterGuardStatus | undefined }) {
  if (!isGuardAffected(guard)) {
    return null;
  }

  return (
    <Badge
      variant={guard.readiness === 'unavailable' ? 'danger' : 'warning'}
      size="sm"
    >
      {guard.statusLabel}
    </Badge>
  );
}

function GuardTitle({ label, guard }: { label: string; guard: MarketFilterGuardStatus | undefined }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {label}
      <GuardStatusBadge guard={guard} />
    </span>
  );
}

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
    starredMarkets,
  } = useMarketPreferences();

  const { trendingMode, toggleTrendingMode, customTagMode, toggleCustomTagMode, starredOnly, toggleStarredOnly } = useMarketsFilters();
  const { showUnwhitelistedMarkets, setShowUnwhitelistedMarkets } = useAppSettings();
  const { guardStatuses, hasAffectedGuards } = useMarketFilterDependencyStatus();
  const guardStatusById = useMemo(() => new Map(guardStatuses.map((guard) => [guard.id, guard])), [guardStatuses]);
  const unknownTokensGuard = guardStatusById.get('unknown-tokens');
  const unknownOraclesGuard = guardStatusById.get('unknown-oracles');
  const unwhitelistedMarketsGuard = guardStatusById.get('unwhitelisted-markets');
  const starredCount = starredMarkets.length;

  // Navigate to a specific detail view, then reopen filter when settings closes
  const handleOpenDetailView = (detailView: DetailViewType) => {
    onClose();
    openModal('monarchSettings', {
      initialDetailView: detailView,
      onCloseCallback: onOpen,
    });
  };

  // Guards are active when the "show" flags are FALSE (meaning risky content is hidden)
  const anyGuardActive = !includeUnknownTokens || !showUnknownOracle || !showUnwhitelistedMarkets || !showLockedMarkets;
  const advancedFilterActive = minSupplyEnabled || minBorrowEnabled || minLiquidityEnabled || trendingMode || customTagMode || starredOnly;
  const hasActiveFilters = advancedFilterActive || anyGuardActive;

  const isButtonVariant = variant === 'button';

  const formatThreshold = (value: string) => `>= $${formatReadable(parseNumericThreshold(value))}`;
  return (
    <div className={className}>
      <Tooltip
        content={
          <TooltipContent
            title="Filters"
            detail={hasAffectedGuards ? 'Some active filters cannot be fully checked' : 'Toggle market filters and risk guards'}
            icon={<GoFilter size={14} />}
          />
        }
      >
        <Button
          variant={isButtonVariant ? 'default' : 'ghost'}
          size={isButtonVariant ? 'md' : 'sm'}
          className={isButtonVariant ? 'relative w-10 min-w-10 px-0' : 'relative min-w-0 px-2 text-secondary'}
          aria-label="Market filters"
          onClick={onOpen}
        >
          <GoFilter
            size={isButtonVariant ? 16 : 14}
            style={{ color: hasActiveFilters ? MONARCH_PRIMARY : undefined }}
          />
          {hasAffectedGuards && (
            <span
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: MONARCH_PRIMARY }}
            />
          )}
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
                helper="Toggle guards to hide unverified or risky markets."
              >
                <FilterRow
                  title={
                    <GuardTitle
                      label="Hide Unknown Tokens"
                      guard={unknownTokensGuard}
                    />
                  }
                  description={getGuardDescription(unknownTokensGuard, 'Filter out tokens outside of the curated list.')}
                >
                  <IconSwitch
                    selected={!includeUnknownTokens}
                    onChange={(checked) => setIncludeUnknownTokens(!checked)}
                    size="xs"
                    color="success"
                    thumbIconOn={GoShieldCheck}
                    thumbIconOff={GoShield}
                  />
                </FilterRow>
                <FilterRow
                  title={
                    <GuardTitle
                      label="Hide Unknown Oracles"
                      guard={unknownOraclesGuard}
                    />
                  }
                  description={getGuardDescription(unknownOraclesGuard, 'Filter out markets with unverified oracle feeds.')}
                >
                  <IconSwitch
                    selected={!showUnknownOracle}
                    onChange={(checked) => setShowUnknownOracle(!checked)}
                    size="xs"
                    color="success"
                    thumbIconOn={GoShieldCheck}
                    thumbIconOff={GoShield}
                  />
                </FilterRow>
                <FilterRow
                  title={
                    <GuardTitle
                      label="Hide Unwhitelisted Markets"
                      guard={unwhitelistedMarketsGuard}
                    />
                  }
                  description={getGuardDescription(unwhitelistedMarketsGuard, 'Filter out markets not listed by Morpho.')}
                >
                  <IconSwitch
                    selected={!showUnwhitelistedMarkets}
                    onChange={(checked) => setShowUnwhitelistedMarkets(!checked)}
                    size="xs"
                    color="success"
                    thumbIconOn={GoShieldCheck}
                    thumbIconOff={GoShield}
                  />
                </FilterRow>
                <FilterRow
                  title="Hide Locked Markets"
                  description="Filter out frozen markets with extreme APY (> 1500%)."
                >
                  <IconSwitch
                    selected={!showLockedMarkets}
                    onChange={(checked) => setShowLockedMarkets(!checked)}
                    size="xs"
                    color="success"
                    thumbIconOn={GoShieldCheck}
                    thumbIconOff={GoShield}
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
                  title="Starred Only"
                  description={`Show your ${starredCount} starred market${starredCount === 1 ? '' : 's'}`}
                >
                  <IconSwitch
                    selected={starredOnly}
                    onChange={toggleStarredOnly}
                    size="xs"
                    color="primary"
                    thumbIconOn={GoStar}
                    thumbIconOff={GoStar}
                    disabled={starredCount === 0}
                  />
                </FilterRow>
                {/* Official Growing Filter (backend-computed) */}
                {showOfficialTrending && (
                  <FilterRow
                    title="Growing Only"
                    description="Show markets with backend-computed flow growth"
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

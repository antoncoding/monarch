import { useState, useMemo } from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { Address } from 'viem';
import { Button } from '@/components/common/Button';
import { MarketsTableWithSameLoanAsset } from '@/components/common/MarketsTableWithSameLoanAsset';
import { Spinner } from '@/components/common/Spinner';
import { useMarkets } from '@/hooks/useMarkets';
import { SupportedNetworks } from '@/utils/networks';
import { Market } from '@/utils/types';

type MarketSelectionModalProps = {
  title?: string;
  description?: string;
  vaultAsset?: Address;
  chainId: SupportedNetworks;
  excludeMarketIds?: Set<string>;
  multiSelect?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onSelect: (markets: Market[]) => void;
  confirmButtonText?: string;
};

/**
 * Generic reusable modal for selecting markets
 * Can be used anywhere in the app where market selection is needed
 */
export function MarketSelectionModal({
  title = 'Select Markets',
  description = 'Choose markets from the list below',
  vaultAsset,
  chainId,
  excludeMarketIds,
  multiSelect = true,
  isOpen = true,
  onClose,
  onSelect,
  confirmButtonText,
}: MarketSelectionModalProps) {
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set());
  const { markets, loading: marketsLoading } = useMarkets();

  // Filter available markets
  const availableMarkets = useMemo(() => {
    if (!markets) return [];

    let filtered = markets.filter((m) => m.morphoBlue.chain.id === chainId);

    // Filter by vault asset if provided
    if (vaultAsset) {
      filtered = filtered.filter(
        (m) => m.loanAsset.address.toLowerCase() === vaultAsset.toLowerCase()
      );
    }

    // Exclude already selected markets if provided
    if (excludeMarketIds) {
      filtered = filtered.filter(
        (m) => !excludeMarketIds.has(m.uniqueKey.toLowerCase())
      );
    }

    return filtered;
  }, [markets, vaultAsset, chainId, excludeMarketIds]);

  const handleToggleMarket = (marketId: string) => {
    if (!multiSelect) {
      const market = availableMarkets.find((m) => m.uniqueKey === marketId);
      if (market) {
        onSelect([market]);
        onClose();
      }
      return;
    }

    // Multi-select mode
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) {
        next.delete(marketId);
      } else {
        next.add(marketId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const marketsToReturn = availableMarkets.filter((m) =>
      selectedMarkets.has(m.uniqueKey)
    );
    onSelect(marketsToReturn);
    onClose();
  };

  const selectedCount = selectedMarkets.size;
  const buttonText = confirmButtonText ?? (
    multiSelect
      ? `Select ${selectedCount > 0 ? selectedCount : ''} Market${selectedCount !== 1 ? 's' : ''}`
      : 'Select Market'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      scrollBehavior="inside"
      classNames={{
        wrapper: 'z-[2200]',
        backdrop: 'z-[2190] bg-black/60',
        base: 'rounded-sm bg-surface',
        header: 'px-6 pt-6 pb-2',
        body: 'px-6 pb-2',
        footer: 'px-6 pt-2 pb-6',
      }}
    >
      <ModalContent>
        <>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-medium">{title}</h3>
            <p className="text-xs text-secondary">{description}</p>
          </ModalHeader>

          <ModalBody className="font-zen">
            {marketsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size={24} />
              </div>
            ) : availableMarkets.length === 0 ? (
              <div className="py-12 text-center text-sm text-secondary">
                {excludeMarketIds && excludeMarketIds.size > 0
                  ? 'No more markets available to select.'
                  : 'No markets found matching the criteria.'}
              </div>
            ) : (
              <MarketsTableWithSameLoanAsset
                markets={availableMarkets.map((m) => ({
                  market: m,
                  isSelected: selectedMarkets.has(m.uniqueKey),
                }))}
                onToggleMarket={handleToggleMarket}
                disabled={false}
                uniqueCollateralTokens={undefined}
                showSelectColumn={multiSelect}
              />
            )}
          </ModalBody>

          <ModalFooter className="flex items-center justify-between">
            {multiSelect ? (
              <>
                <p className="text-xs text-secondary">
                  {selectedCount} market{selectedCount !== 1 ? 's' : ''} selected
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="subtle" size="sm" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="cta"
                    size="sm"
                    isDisabled={selectedCount === 0}
                    onPress={handleConfirm}
                  >
                    {buttonText}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex w-full justify-end">
                <Button variant="subtle" size="sm" onPress={onClose}>
                  Cancel
                </Button>
              </div>
            )}
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  );
}

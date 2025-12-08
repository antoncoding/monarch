import { useState, useMemo } from 'react';
import { FiSearch } from 'react-icons/fi';
import type { Address } from 'viem';
import { Button } from '@/components/common/Button';
import { MarketsTableWithSameLoanAsset } from '@/components/common/MarketsTableWithSameLoanAsset';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { useMarkets } from '@/hooks/useMarkets';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

type MarketSelectionModalProps = {
  title?: string;
  description?: string;
  vaultAsset?: Address;
  chainId: SupportedNetworks;
  excludeMarketIds?: Set<string>;
  multiSelect?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
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
  onOpenChange,
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
      filtered = filtered.filter((m) => m.loanAsset.address.toLowerCase() === vaultAsset.toLowerCase());
    }

    // Exclude already selected markets if provided
    if (excludeMarketIds) {
      filtered = filtered.filter((m) => !excludeMarketIds.has(m.uniqueKey.toLowerCase()));
    }

    return filtered;
  }, [markets, vaultAsset, chainId, excludeMarketIds]);

  const handleToggleMarket = (marketId: string) => {
    if (!multiSelect) {
      const market = availableMarkets.find((m) => m.uniqueKey === marketId);
      if (market) {
        onSelect([market]);
        onOpenChange(false);
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
    const marketsToReturn = availableMarkets.filter((m) => selectedMarkets.has(m.uniqueKey));
    onSelect(marketsToReturn);
    onOpenChange(false);
  };

  const selectedCount = selectedMarkets.size;
  const buttonText =
    confirmButtonText ??
    (multiSelect ? `Select ${selectedCount > 0 ? selectedCount : ''} Market${selectedCount !== 1 ? 's' : ''}` : 'Select Market');

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="4xl"
      scrollBehavior="inside"
      zIndex="selection"
      backdrop="blur"
      className="max-h-[80%] overflow-y-auto"
    >
      <ModalHeader
        title={title}
        description={description}
        mainIcon={<FiSearch className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody>
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
              <Button
                variant="subtle"
                size="sm"
                onPress={() => onOpenChange(false)}
              >
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
            <Button
              variant="subtle"
              size="sm"
              onPress={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </ModalFooter>
    </Modal>
  );
}

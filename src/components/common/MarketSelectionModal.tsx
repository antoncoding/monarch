import { useState, useMemo } from 'react';
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
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) {
        next.delete(marketId);
      } else {
        if (multiSelect) {
          next.add(marketId);
        } else {
          // Single select mode - clear previous selection
          next.clear();
          next.add(marketId);
        }
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleBackdropKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  if (marketsLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={handleBackdropClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleBackdropKeyDown}
        aria-label="Close market selection"
      >
        <div className="w-full max-w-2xl rounded-lg bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-center py-12">
            <Spinner size={24} />
          </div>
        </div>
      </div>
    );
  }

  const selectedCount = selectedMarkets.size;
  const buttonText = confirmButtonText ?? (
    multiSelect
      ? `Select ${selectedCount > 0 ? selectedCount : ''} Market${selectedCount !== 1 ? 's' : ''}`
      : 'Select Market'
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleBackdropKeyDown}
      aria-label="Close market selection"
    >
      <div className="w-full max-w-4xl h-[56vh] max-h-[85vh] rounded-lg bg-surface shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h3 className="text-lg font-medium">{title}</h3>
            <p className="text-xs text-secondary mt-1">{description}</p>
          </div>
        </div>

        {availableMarkets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-secondary">
              {excludeMarketIds && excludeMarketIds.size > 0
                ? 'No more markets available to select.'
                : 'No markets found matching the criteria.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6">
            <MarketsTableWithSameLoanAsset
              markets={availableMarkets.map((m) => ({
                market: m,
                isSelected: selectedMarkets.has(m.uniqueKey),
              }))}
              onToggleMarket={handleToggleMarket}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 p-6 pt-4">
          {multiSelect && (
            <p className="text-xs text-secondary">
              {selectedCount} market{selectedCount !== 1 ? 's' : ''} selected
            </p>
          )}
          {!multiSelect && <div />}
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
        </div>
      </div>
    </div>
  );
}

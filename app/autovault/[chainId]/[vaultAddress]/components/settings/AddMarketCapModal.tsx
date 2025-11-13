"use client";

import { Address } from 'viem';

import { MarketSelectionModal } from '@/components/common/MarketSelectionModal';
import { SupportedNetworks } from '@/utils/networks';
import { Market } from '@/utils/types';

type AddMarketCapModalProps = {
  vaultAsset: Address;
  chainId: SupportedNetworks;
  existingMarketIds: Set<string>;
  onOpenChange: (open: boolean) => void;
  onAdd: (markets: Market[]) => void;
};

/**
 * Wrapper around MarketSelectionModal for adding market caps
 * Provides cap-specific labels and context
 */
export function AddMarketCapModal({
  vaultAsset,
  chainId,
  existingMarketIds,
  onOpenChange,
  onAdd,
}: AddMarketCapModalProps) {
  return (
    <MarketSelectionModal
      title="Add Market Caps"
      description="Select markets to add allocation caps"
      vaultAsset={vaultAsset}
      chainId={chainId}
      excludeMarketIds={existingMarketIds}
      multiSelect
      onOpenChange={onOpenChange}
      onSelect={onAdd}
      confirmButtonText={undefined} // Use default dynamic text
    />
  );
}

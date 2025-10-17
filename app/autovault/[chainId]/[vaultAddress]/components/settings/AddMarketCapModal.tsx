import { Address } from 'viem';
import { MarketSelectionModal } from '@/components/common/MarketSelectionModal';
import { Market } from '@/utils/types';
import { SupportedNetworks } from '@/utils/networks';

type AddMarketCapModalProps = {
  vaultAsset: Address;
  chainId: SupportedNetworks;
  existingMarketIds: Set<string>;
  onClose: () => void;
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
  onClose,
  onAdd,
}: AddMarketCapModalProps) {
  return (
    <MarketSelectionModal
      title="Add Market Caps"
      description="Select markets to add allocation caps"
      vaultAsset={vaultAsset}
      chainId={chainId}
      excludeMarketIds={existingMarketIds}
      multiSelect={true}
      onClose={onClose}
      onSelect={onAdd}
      confirmButtonText={undefined} // Use default dynamic text
    />
  );
}

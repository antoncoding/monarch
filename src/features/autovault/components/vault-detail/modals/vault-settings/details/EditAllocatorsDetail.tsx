'use client';

import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import type { SupportedNetworks } from '@/utils/networks';
import { EditAllocators } from '../../../settings/EditAllocators';

type EditAllocatorsDetailProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onBack: () => void;
};

export function EditAllocatorsDetail({ vaultAddress, chainId, onBack }: EditAllocatorsDetailProps) {
  const { address: connectedAddress } = useConnection();

  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner, setAllocator, isUpdatingAllocator } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
    // Note: onTransactionSuccess is not used here because we update inplace and don't navigate back automatically
    // The user clicks "Done" when finished
  });

  const allocators = (vaultData?.allocators ?? []) as Address[];

  return (
    <EditAllocators
      allocators={allocators}
      chainId={chainId}
      isOwner={isOwner}
      isUpdating={isUpdatingAllocator}
      onAddAllocator={(allocator) => setAllocator(allocator, true)}
      onRemoveAllocator={(allocator) => setAllocator(allocator, false)}
      onBack={onBack}
    />
  );
}

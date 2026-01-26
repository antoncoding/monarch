'use client';

import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import type { SupportedNetworks } from '@/utils/networks';
import { EditMetadata } from '../../../settings/EditMetadata';

type EditMetadataDetailProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onBack: () => void;
};

export function EditMetadataDetail({ vaultAddress, chainId, onBack }: EditMetadataDetailProps) {
  const { address: connectedAddress } = useConnection();

  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner, name, symbol, updateNameAndSymbol, isUpdatingMetadata } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
    onTransactionSuccess: onBack,
  });

  const defaultName = vaultData?.displayName ?? '';
  const defaultSymbol = vaultData?.displaySymbol ?? '';

  return (
    <EditMetadata
      chainId={chainId}
      isOwner={isOwner}
      isUpdating={isUpdatingMetadata}
      defaultName={defaultName}
      defaultSymbol={defaultSymbol}
      currentName={name}
      currentSymbol={symbol}
      onUpdate={(name, symbol) => updateNameAndSymbol({ name, symbol })}
      onCancel={onBack}
    />
  );
}

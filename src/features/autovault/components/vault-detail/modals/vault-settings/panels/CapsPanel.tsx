'use client';

import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import type { SupportedNetworks } from '@/utils/networks';
import { CurrentCaps } from '../../../settings/CurrentCaps';
import type { VaultDetailView } from '@/stores/vault-settings-modal-store';

type CapsPanelProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onNavigateToDetail?: (view: Exclude<VaultDetailView, null>) => void;
};

export function CapsPanel({ vaultAddress, chainId, onNavigateToDetail }: CapsPanelProps) {
  const { address: connectedAddress } = useConnection();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
  });

  const vaultAsset = vaultData?.assetAddress as Address | undefined;
  const existingCaps = vaultData?.capsData;

  return (
    <CurrentCaps
      existingCaps={existingCaps}
      isOwner={isOwner}
      onStartEdit={() => onNavigateToDetail?.('edit-caps')}
      vaultAsset={vaultAsset}
      chainId={chainId}
    />
  );
}

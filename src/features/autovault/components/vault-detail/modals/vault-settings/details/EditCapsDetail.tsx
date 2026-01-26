'use client';

import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import type { SupportedNetworks } from '@/utils/networks';
import { EditCaps } from '../../../settings/EditCaps';

type EditCapsDetailProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onBack: () => void;
};

export function EditCapsDetail({ vaultAddress, chainId, onBack }: EditCapsDetailProps) {
  const { address: connectedAddress } = useConnection();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner, updateCaps, isUpdatingCaps } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
    onTransactionSuccess: onBack, // Navigate AFTER tx confirms, not when sent
  });
  const { morphoMarketV1Adapter: adapterAddress } = useMorphoMarketV1Adapters({
    vaultAddress,
    chainId,
  });

  const vaultAsset = vaultData?.assetAddress as Address | undefined;
  const existingCaps = vaultData?.capsData;

  return (
    <EditCaps
      existingCaps={existingCaps}
      vaultAsset={vaultAsset}
      chainId={chainId}
      isOwner={isOwner}
      isUpdating={isUpdatingCaps}
      adapterAddress={adapterAddress}
      onBack={onBack}
      onSave={async (caps) => {
        const success = await updateCaps(caps);
        // Don't call onBack() here - onTransactionSuccess handles navigation after tx confirms
        // This allows the toast to appear before the component unmounts
        return success;
      }}
    />
  );
}

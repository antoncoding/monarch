import { useState } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { CurrentCaps } from './CurrentCaps';
import { EditCaps } from './EditCaps';
import type { CapsTabProps } from './types';

export function CapsTab({ vaultAddress, chainId }: CapsTabProps) {
  const { address: connectedAddress } = useConnection();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner, updateCaps, isUpdatingCaps } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
  });
  const { morphoMarketV1Adapter: adapterAddress } = useMorphoMarketV1Adapters({
    vaultAddress,
    chainId,
  });

  const vaultAsset = vaultData?.assetAddress as Address | undefined;
  const existingCaps = vaultData?.capsData;

  const [isEditing, setIsEditing] = useState(false);

  return isEditing ? (
    <EditCaps
      existingCaps={existingCaps}
      vaultAsset={vaultAsset}
      chainId={chainId}
      isOwner={isOwner}
      isUpdating={isUpdatingCaps}
      adapterAddress={adapterAddress}
      onCancel={() => setIsEditing(false)}
      onSave={async (caps) => {
        const success = await updateCaps(caps);
        if (success) {
          setIsEditing(false);
        }
        return success;
      }}
    />
  ) : (
    <CurrentCaps
      existingCaps={existingCaps}
      isOwner={isOwner}
      onStartEdit={() => setIsEditing(true)}
      vaultAsset={vaultAsset}
      chainId={chainId}
    />
  );
}

import { useState } from 'react';
import { CurrentAllocations } from './CurrentAllocations';
import { EditAllocations } from './EditAllocations';
import { AllocationsTabProps } from './types';

export function AllocationsTab({
  isOwner,
  chainId,
  vaultAsset,
  adapterAddress,
  existingCaps,
  updateCaps,
  isUpdatingCaps,
}: AllocationsTabProps) {
  const [isEditing, setIsEditing] = useState(false);

  return isEditing ? (
    <EditAllocations
      existingCaps={existingCaps}
      vaultAsset={vaultAsset}
      chainId={chainId}
      isOwner={isOwner}
      isUpdating={isUpdatingCaps}
      adapterAddress={adapterAddress}
      onCancel={() => setIsEditing(false)}
      onSave={async (caps) => {
        const success = await onUpdateCaps(caps);
        if (success) {
          setIsEditing(false);
        }
        return success;
      }}
    />
  ) : (
    <CurrentAllocations
      existingCaps={existingCaps}
      isOwner={isOwner}
      onStartEdit={() => setIsEditing(true)}
      vaultAsset={vaultAsset}
      networkId=
    />
  );
}

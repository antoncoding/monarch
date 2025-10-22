import { useState } from 'react';
import { CurrentCaps } from './CurrentCaps';
import { EditCaps } from './EditCaps';
import { CapsTabProps } from './types';

export function CapsTab({
  isOwner,
  chainId,
  vaultAsset,
  adapterAddress,
  existingCaps,
  updateCaps,
  isUpdatingCaps,
}: CapsTabProps) {
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

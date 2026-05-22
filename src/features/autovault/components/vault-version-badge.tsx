'use client';

import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { isTrustedVaultV2 } from '@/utils/vaults';

type VaultVersionBadgeProps = {
  vault: TrustedVault;
};

export function VaultVersionBadge({ vault }: VaultVersionBadgeProps) {
  if (!isTrustedVaultV2(vault)) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
      v2
    </span>
  );
}

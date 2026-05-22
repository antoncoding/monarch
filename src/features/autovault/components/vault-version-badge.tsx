'use client';

import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { isTrustedVaultV2 } from '@/utils/vaults';

type VaultVersionBadgeProps = {
  vault: TrustedVault;
};

export function VaultVersionBadge({ vault }: VaultVersionBadgeProps) {
  if (!vault.version) {
    return null;
  }

  const isV2 = isTrustedVaultV2(vault);

  return (
    <span
      className={`inline-flex shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none ${
        isV2 ? 'bg-primary/10 text-primary' : 'bg-hovered text-secondary'
      }`}
    >
      {vault.version}
    </span>
  );
}

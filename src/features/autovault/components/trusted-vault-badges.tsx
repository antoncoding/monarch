'use client';

import { Tooltip } from '@heroui/react';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import type { TrustedVault } from '@/constants/vaults/known_vaults';

type MoreVaultsBadgeProps = {
  vaults: TrustedVault[];
  badgeSize?: number;
};

export function MoreVaultsBadge({ vaults, badgeSize = 22 }: MoreVaultsBadgeProps) {
  if (vaults.length === 0) return null;

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
        <TooltipContent
          title={<span className="text-sm font-semibold">More trusted vaults</span>}
          detail={
            <div className="flex flex-col gap-2">
              {vaults.map((vault) => (
                <VaultIdentity
                  key={`${vault.address}-${vault.chainId}`}
                  address={vault.address}
                  chainId={vault.chainId}
                  curator={vault.curator}
                  vaultName={vault.name}
                  variant="inline"
                  showAddressInTooltip={false}
                />
              ))}
            </div>
          }
        />
      }
    >
      <span
        className="-ml-2 flex items-center justify-center rounded-full border border-background/40 bg-hovered text-[11px] text-secondary"
        style={{
          width: badgeSize,
          height: badgeSize,
          zIndex: 0,
        }}
      >
        +{vaults.length}
      </span>
    </Tooltip>
  );
}

type TrustedByCellProps = {
  vaults: TrustedVault[];
  badgeSize?: number;
};

export function TrustedByCell({ vaults, badgeSize = 22 }: TrustedByCellProps) {
  if (!vaults.length) {
    return <span className="text-xs text-secondary">-</span>;
  }

  const preview = vaults.slice(0, 3);

  return (
    <div className="flex items-center justify-center">
      {preview.map((vault, index) => (
        <div
          key={`${vault.address}-${vault.chainId}`}
          className={`relative ${index === 0 ? 'ml-0' : '-ml-2'}`}
          style={{ zIndex: preview.length - index }}
        >
          <VaultIdentity
            address={vault.address}
            chainId={vault.chainId}
            curator={vault.curator}
            vaultName={vault.name}
            variant="icon"
            iconSize={badgeSize}
            className="rounded-full border border-background/40 bg-surface transition-transform duration-150 hover:-translate-y-1"
            showAddressInTooltip={false}
          />
        </div>
      ))}
      {vaults.length > preview.length && (
        <MoreVaultsBadge
          vaults={vaults.slice(preview.length)}
          badgeSize={badgeSize}
        />
      )}
    </div>
  );
}

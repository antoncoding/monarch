'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { VaultVersionBadge } from '@/features/autovault/components/vault-version-badge';
import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { isTrustedVaultV2 } from '@/utils/vaults';

const TRUSTED_BY_ICON_SIZE = 16;

type MoreVaultsBadgeProps = {
  count: number;
  badgeSize?: number;
};

export function MoreVaultsBadge({ count, badgeSize = TRUSTED_BY_ICON_SIZE }: MoreVaultsBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className="ml-1 inline-flex items-center justify-center font-monospace text-[11px] leading-none text-secondary"
      style={{
        height: badgeSize,
      }}
    >
      +{count}
    </span>
  );
}

type TrustedByCellProps = {
  vaults: TrustedVault[];
  badgeSize?: number;
};

function TrustedVaultTooltipRow({ vault }: { vault: TrustedVault }) {
  const showVaultLink = isTrustedVaultV2(vault);

  return (
    <div className="flex items-center gap-2">
      <VaultIdentity
        address={vault.address}
        asset={vault.asset}
        chainId={vault.chainId}
        description={vault.metadataDescription}
        imageSrc={vault.metadataImage}
        vaultName={vault.name}
        variant="inline"
        showAddressInTooltip={false}
        showLink={showVaultLink}
        showTooltip={false}
      />
      <VaultVersionBadge vault={vault} />
    </div>
  );
}

export function TrustedByCell({ vaults, badgeSize = TRUSTED_BY_ICON_SIZE }: TrustedByCellProps) {
  if (!vaults.length) {
    return <span className="text-xs text-secondary">-</span>;
  }

  const preview = vaults.slice(0, 3);
  const hiddenCount = vaults.length - preview.length;

  return (
    <Tooltip
      content={
        <TooltipContent
          title={<span className="text-sm font-semibold">Trusted By</span>}
          detail={
            <div className="flex flex-col gap-2">
              {vaults.map((vault) => (
                <TrustedVaultTooltipRow
                  key={`${vault.address}-${vault.chainId}`}
                  vault={vault}
                />
              ))}
            </div>
          }
        />
      }
    >
      <div className="flex items-center justify-center">
        {preview.map((vault, index) => (
          <div
            key={`${vault.address}-${vault.chainId}`}
            className={`relative ${index === 0 ? 'ml-0' : '-ml-2'}`}
            style={{ zIndex: preview.length - index }}
          >
            <VaultIdentity
              address={vault.address}
              asset={vault.asset}
              chainId={vault.chainId}
              description={vault.metadataDescription}
              imageSrc={vault.metadataImage}
              vaultName={vault.name}
              variant="icon"
              iconSize={badgeSize}
              className="rounded-full border border-background/40 bg-surface transition-transform duration-150 hover:-translate-y-1"
              showAddressInTooltip={false}
              showLink={isTrustedVaultV2(vault)}
              showTooltip={false}
            />
          </div>
        ))}
        {hiddenCount > 0 && (
          <MoreVaultsBadge
            count={hiddenCount}
            badgeSize={badgeSize}
          />
        )}
      </div>
    </Tooltip>
  );
}

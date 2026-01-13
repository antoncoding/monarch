'use client';

import { useMemo, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import type { VaultCurator } from '@/constants/vaults/known_vaults';
import { getVaultURL } from '@/utils/external';
import { VaultIcon } from './vault-icon';

type VaultIdentityVariant = 'chip' | 'inline' | 'icon';

type VaultIdentityProps = {
  address: `0x${string}`;
  asset?: `0x${string}`;
  chainId: number;
  curator: VaultCurator | string;
  vaultName?: string;
  showLink?: boolean;
  variant?: VaultIdentityVariant;
  showTooltip?: boolean;
  iconSize?: number;
  className?: string;
  tooltipDetail?: ReactNode;
  tooltipSecondaryDetail?: ReactNode;
  showAddressInTooltip?: boolean;
};

export function VaultIdentity({
  address,
  asset,
  chainId,
  curator,
  vaultName,
  showLink = true,
  variant = 'chip',
  showTooltip = true,
  iconSize = 20,
  className = '',
  tooltipDetail,
  tooltipSecondaryDetail,
  showAddressInTooltip = true,
}: VaultIdentityProps) {
  const vaultHref = useMemo(() => getVaultURL(address, chainId), [address, chainId]);
  const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const displayName = vaultName ?? formattedAddress;
  const curatorLabel = curator === 'unknown' ? 'Curator unknown' : `Curated by ${curator}`;

  const baseContent = (() => {
    if (variant === 'icon') {
      return (
        <div className={`inline-flex items-center ${className}`}>
          <VaultIcon
            curator={curator}
            width={iconSize}
            height={iconSize}
          />
        </div>
      );
    }

    if (variant === 'inline') {
      return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
          <VaultIcon
            curator={curator}
            width={iconSize}
            height={iconSize}
          />
          <div className="flex flex-col leading-tight font-zen">
            <span className="text-sm text-primary">{displayName}</span>
            <span className="text-[11px] text-secondary">{curatorLabel}</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`inline-flex items-center gap-2 rounded bg-hovered px-2 py-1 text-xs text-secondary ${className}`}>
        <VaultIcon
          curator={curator}
          width={iconSize}
          height={iconSize}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-primary">{displayName}</span>
          <span className="font-monospace text-[10px]">{formattedAddress}</span>
        </div>
      </div>
    );
  })();

  const interactiveContent = showLink ? (
    <Link
      href={vaultHref}
      target="_blank"
      rel="noopener noreferrer"
      className="no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      {baseContent}
    </Link>
  ) : (
    baseContent
  );

  if (!showTooltip) {
    return interactiveContent;
  }

  const resolvedDetail = tooltipDetail ?? (
    <div className="flex flex-col gap-1 text-sm">
      {showAddressInTooltip && <span className="rounded bg-hovered px-1 py-0.5 font-monospace text-xs opacity-70">{address}</span>}
      <span className="text-secondary">{curatorLabel}</span>
    </div>
  );

  const tooltipTitle = (
    <div className="flex items-center gap-2">
      <span>{displayName}</span>
      {asset && (
        <TokenIcon
          address={asset}
          chainId={chainId}
          width={18}
          height={18}
          disableTooltip
        />
      )}
    </div>
  );

  return (
    <Tooltip
      content={
        <TooltipContent
          icon={
            <VaultIcon
              curator={curator}
              width={32}
              height={32}
            />
          }
          title={tooltipTitle}
          detail={resolvedDetail}
          secondaryDetail={tooltipSecondaryDetail}
          actionIcon={<ExternalLinkIcon className="h-4 w-4" />}
          actionHref={vaultHref}
          onActionClick={(e) => e.stopPropagation()}
        />
      }
    >
      {interactiveContent}
    </Tooltip>
  );
}

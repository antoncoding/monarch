'use client';

import React, { useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { FiExternalLink } from 'react-icons/fi';
import { TooltipContent } from '@/components/TooltipContent';
import {
  VaultCurator,
  getVaultLogo,
} from '@/constants/vaults/trusted_vaults';
import { getVaultURL } from '@/utils/external';

type VaultIconProps = {
  curator: VaultCurator | string;
  address?: string;
  chainId?: number;
  width?: number;
  height?: number;
  showTooltip?: boolean;
  vaultName?: string;
  showLink?: boolean;
  className?: string;
};

export function VaultIcon({
  curator,
  address,
  chainId,
  width = 24,
  height = 24,
  showTooltip = true,
  vaultName,
  showLink = false,
  className = '',
}: VaultIconProps) {
  // Get curator logo path
  const logoSrc = useMemo(() => {
    const logo = getVaultLogo(curator);
    console.log('[VaultIcon] curator:', curator, 'logoSrc:', logo);
    return logo;
  }, [curator]);

  const iconElement = (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <Image
        src={logoSrc}
        alt={`${curator} logo`}
        width={width}
        height={height}
        className="object-contain p-0.5"
      />
    </div>
  );

  // Build tooltip detail text - must be called before any early returns
  const detailText = useMemo(() => {
    const parts: string[] = [];
    if (curator && curator !== 'unknown') {
      parts.push(`Curated by ${curator}`);
    } else if (curator === 'unknown') {
      parts.push('Morpho Vault');
    }
    if (address) {
      parts.push(address);
    }
    return parts.join(' • ');
  }, [curator, address]);

  const vaultUrl = address && chainId && showLink
    ? getVaultURL(address, chainId)
    : null;

  if (!showTooltip) {
    return iconElement;
  }

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
        <TooltipContent
          icon={iconElement}
          title={vaultName ?? curator}
          detail={detailText}
          actionIcon={vaultUrl ? <FiExternalLink className="h-4 w-4" /> : undefined}
          actionHref={vaultUrl ?? undefined}
          onActionClick={(e) => e.stopPropagation()}
        />
      }
    >
      {iconElement}
    </Tooltip>
  );
}

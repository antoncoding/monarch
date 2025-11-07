'use client';

import React from 'react';
import { Tooltip } from '@heroui/react';
import { FiExternalLink } from 'react-icons/fi';
import { TooltipContent } from '@/components/TooltipContent';
import {
  VaultVendor,
  getVaultIcon,
  getVaultColor,
} from '@/constants/vaults/trusted_vaults';
import { getVaultURL } from '@/utils/external';

type VaultIconProps = {
  vendor: VaultVendor | string;
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
  vendor,
  address,
  chainId,
  width = 24,
  height = 24,
  showTooltip = true,
  vaultName,
  showLink = false,
  className = '',
}: VaultIconProps) {
  // Safely get icon and color with fallback and debug logging
  const Icon = getVaultIcon(vendor);
  const color = getVaultColor(vendor);

  const iconElement = (
    <div
      className={`flex items-center justify-center rounded-full ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: color,
      }}
    >
      <Icon className="text-white" style={{ fontSize: `${width * 0.6}px` }} />
    </div>
  );

  if (!showTooltip) {
    return iconElement;
  }

  const vaultUrl = address && chainId && showLink
    ? getVaultURL(address, chainId)
    : null;

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
        <TooltipContent
          icon={iconElement}
          title={vaultName ?? vendor}
          detail={`Vault managed by ${vendor}`}
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

'use client';

import { useMemo } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Address } from 'viem';
import { VaultIcon } from './VaultIcon';
import { VaultVendor } from '@/constants/vaults/trusted_vaults';
import { getVaultURL } from '@/utils/external';

type VaultIdentityProps = {
  address: Address;
  chainId: number;
  vendor: VaultVendor | string;
  vaultName?: string;
  showLink?: boolean;
  showIcon?: boolean;
  className?: string;
};

export function VaultIdentity({
  address,
  chainId,
  vendor,
  vaultName,
  showLink = true,
  showIcon = true,
  className = '',
}: VaultIdentityProps) {
  const vaultHref = useMemo(() => {
    return getVaultURL(address, chainId);
  }, [address, chainId]);

  const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const displayName = vaultName ?? formattedAddress;

  if (!showLink) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {showIcon && (
          <VaultIcon
            vendor={vendor}
            address={address}
            chainId={chainId}
            width={20}
            height={20}
            showTooltip={false}
          />
        )}
        <span className="rounded bg-hovered px-2 py-1 font-monospace text-xs text-secondary">
          {displayName}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={vaultHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded bg-hovered px-2 py-1 font-monospace text-xs text-secondary no-underline transition-colors hover:bg-gray-300 hover:text-primary hover:no-underline dark:hover:bg-gray-700 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && (
        <VaultIcon
          vendor={vendor}
          address={address}
          chainId={chainId}
          width={20}
          height={20}
          showTooltip={false}
        />
      )}
      <span>{displayName}</span>
      <ExternalLinkIcon className="h-3 w-3" />
    </Link>
  );
}

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Avatar } from '@/components/Avatar/Avatar';
import { getExplorerURL } from '@/utils/external';

type RoleAddressItemProps = {
  address: string;
  chainId: number;
  label?: string;
  icon?: ReactNode;
};

/**
 * Displays an address with optional custom label and icon.
 * Follows AddressIdentity style: icon + label + shortened address + external link
 */
export function RoleAddressItem({ address, chainId, label, icon }: RoleAddressItemProps) {
  return (
    <Link
      href={getExplorerURL(address as `0x${string}`, chainId)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-sm bg-hovered px-2 py-1 text-xs text-secondary no-underline hover:bg-gray-300 dark:hover:bg-gray-700"
    >
      {icon ?? <Avatar address={address as `0x${string}`} size={14} />}
      {label && <span>{label}</span>}
      <span className="font-mono text-[11px]">
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <ExternalLinkIcon className="h-3 w-3" />
    </Link>
  );
}

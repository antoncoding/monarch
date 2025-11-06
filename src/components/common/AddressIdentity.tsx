'use client';

import { useMemo } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Address } from 'viem';
import { Name } from '@/components/common/Name';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';

type AddressIdentityProps = {
  address: Address;
  chainId: SupportedNetworks;
  showExplorerLink?: boolean;
  className?: string;
};

export function AddressIdentity({
  address,
  chainId,
  showExplorerLink = true,
  className = '',
}: AddressIdentityProps) {
  const explorerHref = useMemo(() => {
    return getExplorerURL(address as `0x${string}`, chainId);
  }, [address, chainId]);

  if (!showExplorerLink) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <Name
          address={address as `0x${string}`}
          className="rounded bg-hovered px-2 py-1 font-monospace text-xs text-secondary"
        />
      </div>
    );
  }

  return (
    <Link
      href={explorerHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded bg-hovered px-2 py-1 font-monospace text-xs text-secondary no-underline transition-colors hover:bg-gray-300 hover:text-primary hover:no-underline dark:hover:bg-gray-700 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Name address={address as `0x${string}`} />
      <ExternalLinkIcon className="h-3 w-3" />
    </Link>
  );
}

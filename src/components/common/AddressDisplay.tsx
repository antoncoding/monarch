'use client';

import { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import { FaCircle } from 'react-icons/fa';
import { LuExternalLink } from 'react-icons/lu';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { Name } from '@/components/common/Name';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';

type AddressDisplayProps = {
  address: Address;
  chainId?: SupportedNetworks | number;
  size?: 'md' | 'sm';
  showExplorerLink?: boolean;
  className?: string;
};

export function AddressDisplay({
  address,
  chainId,
  size = 'md',
  showExplorerLink = false,
  className,
}: AddressDisplayProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOwner = useMemo(() => {
    return address === connectedAddress;
  }, [address, connectedAddress]);

  const explorerHref = useMemo(() => {
    if (!showExplorerLink || chainId === undefined) return null;
    const numericChainId = Number(chainId);
    if (!Number.isFinite(numericChainId)) return null;
    return getExplorerURL(address as `0x${string}`, numericChainId as SupportedNetworks);
  }, [address, chainId, showExplorerLink]);

  if (size === 'sm') {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        <Name
          address={address as `0x${string}`}
          className={clsx(
            'rounded px-2 py-1 font-monospace text-xs',
            mounted && isOwner && isConnected
              ? 'bg-green-500/10 text-green-500'
              : 'bg-hovered text-secondary',
          )}
        />
        {explorerHref && (
          <a
            href={explorerHref}
            target="_blank"
            rel="noreferrer"
            className="text-secondary transition-colors hover:text-primary"
            aria-label="View on explorer"
          >
            <LuExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('flex items-start gap-4', className)}>
      <div className="relative overflow-hidden rounded">
        <Avatar address={address} size={36} rounded={false} />
        {mounted && isOwner && isConnected && (
          <div className="absolute bottom-0 right-0 h-4 w-full bg-gradient-to-r from-green-500/20 to-green-500/40 backdrop-blur-sm">
            <div className="absolute bottom-1 right-1">
              <FaCircle size={8} className="text-green-500" />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <Name
            address={address as `0x${string}`}
            className={clsx(
              'rounded p-2 font-monospace text-sm',
              mounted && isOwner && isConnected
                ? 'bg-green-500/10 text-green-500'
                : 'bg-hovered text-secondary',
            )}
          />
          {explorerHref && (
            <a
              href={explorerHref}
              target="_blank"
              rel="noreferrer"
              className="text-secondary transition-colors hover:text-primary"
              aria-label="View on explorer"
            >
              <LuExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

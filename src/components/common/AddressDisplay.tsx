'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { FaCircle } from 'react-icons/fa';
import { LuExternalLink } from 'react-icons/lu';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { Name } from '@/components/common/Name';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';

type AddressDisplayProps = {
  address: Address;
  chainId?: SupportedNetworks | number;
  size?: 'md' | 'sm';
  showExplorerLink?: boolean;
  className?: string;
  copyable?: boolean;
};

export function AddressDisplay({
  address,
  chainId,
  size = 'md',
  showExplorerLink = false,
  className,
  copyable = false,
}: AddressDisplayProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const { success: toastSuccess } = useStyledToast();

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

  const handleCopy = useCallback(async () => {
    if (!copyable) return;

    try {
      await navigator.clipboard.writeText(address);
      toastSuccess('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, copyable, toastSuccess]);

  if (size === 'sm') {
    return (
      <div
        className={clsx(
          'flex items-center gap-2',
          copyable && 'cursor-pointer transition-colors hover:brightness-110',
          className,
        )}
        onClick={copyable ? handleCopy : undefined}
        role={copyable ? 'button' : undefined}
        tabIndex={copyable ? 0 : undefined}
        onKeyDown={(event) => {
          if (!copyable) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void handleCopy();
          }
        }}
      >
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
            onClick={(event) => event.stopPropagation()}
          >
            <LuExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex items-start gap-4',
        copyable && 'cursor-pointer transition-colors hover:brightness-110',
        className,
      )}
      onClick={copyable ? handleCopy : undefined}
      role={copyable ? 'button' : undefined}
      tabIndex={copyable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!copyable) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void handleCopy();
        }
      }}
    >
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
              onClick={(event) => event.stopPropagation()}
            >
              <LuExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

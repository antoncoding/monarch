'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { LuCopy, LuUser, LuExternalLink } from 'react-icons/lu';
import { SiEthereum } from 'react-icons/si';
import type { Address } from 'viem';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getExplorerURL } from '@/utils/external';
import type { SupportedNetworks } from '@/utils/networks';

type AccountActionsPopoverProps = {
  address: Address;
  chainId?: number;
  children: ReactNode;
};

/**
 * Minimal popover showing account actions:
 * - Copy address
 * - View account (positions page)
 * - View on Etherscan
 */
export function AccountActionsPopover({
  address,
  chainId = 1,
  children,
}: AccountActionsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useStyledToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, toast]);

  const handleViewAccount = useCallback(() => {
    window.location.href = `/positions/${address}`;
    setIsOpen(false);
  }, [address]);

  const handleViewExplorer = useCallback(() => {
    const explorerUrl = getExplorerURL(address, chainId as SupportedNetworks);
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  }, [address, chainId]);

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom"
      offset={8}
      classNames={{
        base: 'p-0',
        content: 'p-0 bg-surface shadow-lg border border-primary/10',
      }}
    >
      <PopoverTrigger>
        <div className="cursor-pointer">{children}</div>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex min-w-[180px] flex-col rounded-sm bg-surface font-zen">
          {/* Copy Address */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
          >
            <LuCopy className="h-4 w-4" />
            <span>Copy Address</span>
          </button>

          {/* View Account */}
          <button
            onClick={handleViewAccount}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
          >
            <LuUser className="h-4 w-4" />
            <span>View Account</span>
          </button>

          {/* View on Explorer */}
          <button
            onClick={handleViewExplorer}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
          >
            <SiEthereum className="h-4 w-4" />
            <span>View on Explorer</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { useCallback, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { LuCopy, LuUser } from 'react-icons/lu';
import { SiEthereum } from 'react-icons/si';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import type { Address } from 'viem';

type AccountActionsPopoverProps = {
  address: Address;
  children?: ReactNode;
  chainId?: number;
};

/**
 * Dropdown menu showing account actions:
 * - Copy address
 * - View account (positions page)
 * - View on Etherscan
 */
export function AccountActionsPopover({ address, chainId, children }: AccountActionsPopoverProps) {
  const toast = useStyledToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, toast]);

  const handleViewAccount = useCallback(() => {
    window.location.href = `/positions/${address}`;
  }, [address]);

  const handleViewExplorer = useCallback(() => {
    const explorerUrl = getExplorerURL(address, (chainId ?? SupportedNetworks.Mainnet) as SupportedNetworks);
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  }, [address, chainId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => void handleCopy()}
          startContent={<LuCopy className="h-4 w-4" />}
        >
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleViewAccount}
          startContent={<LuUser className="h-4 w-4" />}
        >
          View Account
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleViewExplorer}
          startContent={<SiEthereum className="h-4 w-4" />}
        >
          View on Explorer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

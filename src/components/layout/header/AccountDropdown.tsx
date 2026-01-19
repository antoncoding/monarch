'use client';

import { useCallback } from 'react';
import { ExitIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { LuCopy } from 'react-icons/lu';
import { clsx } from 'clsx';
import { useConnection, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Avatar } from '@/components/Avatar/Avatar';
import { AccountIdentity } from '@/components/shared/account-identity';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';

export function AccountDropdown() {
  const { address, chainId } = useConnection();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const toast = useStyledToast();

  const handleDisconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleCopyAddress = useCallback(() => {
    if (address) {
      void navigator.clipboard.writeText(address).then(() => {
        toast.success('Address copied', 'Address copied to clipboard');
      });
    }
  }, [address, toast]);

  const handleOpenModal = useCallback(() => {
    open();
  }, [open]);

  if (!address) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={clsx(
            'flex h-8 w-8 cursor-pointer items-center justify-center',
            'transition-all duration-150 ease-in-out hover:-translate-y-[2px]',
          )}
        >
          <Avatar address={address} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="border-b border-primary/10 pb-4 cursor-pointer"
          onClick={handleOpenModal}
        >
          <div className="flex w-full items-center gap-3">
            <Avatar
              address={address}
              size={32}
            />
            <AccountIdentity
              address={address}
              chainId={chainId ?? SupportedNetworks.Mainnet}
              variant="badge"
              showActions={false}
            />
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleCopyAddress}
          endContent={<LuCopy className="h-4 w-4" />}
        >
          Copy Address
        </DropdownMenuItem>

        <DropdownMenuItem
          endContent={<ExternalLinkIcon className="h-4 w-4" />}
          onClick={() => window.open(getExplorerURL(address, chainId ?? 1), '_blank')}
        >
          View on Explorer
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleDisconnectWallet}
          endContent={<ExitIcon className="h-4 w-4" />}
          className="text-red-500 hover:text-red-500 focus:text-red-500"
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

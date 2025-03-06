'use client';

import { useCallback } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@nextui-org/react';
import { ExitIcon, ExternalLinkIcon, CopyIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { useAccount, useDisconnect } from 'wagmi';
import AccountWithENS from '@/components/Account/AccountWithENS';
import { Avatar } from '@/components/Avatar/Avatar';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getExplorerURL } from '@/utils/external';

export function AccountDropdown() {
  const { address, chainId } = useAccount();
  const { disconnect } = useDisconnect();

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

  if (!address) return null;

  return (
    <Dropdown className="rounded-sm">
      <DropdownTrigger>
        <div
          className={clsx(
            'flex h-8 w-8 cursor-pointer items-center justify-center',
            'transition-all duration-150 ease-in-out hover:-translate-y-[2px]',
          )}
        >
          <Avatar address={address} />
        </div>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Account actions"
        itemClasses={{
          base: [
            'gap-4 px-4 py-2 rounded-none font-zen',
            'data-[hover=true]:bg-hovered rounded-sm',
          ].join(' '),
          title: 'text-sm text-primary flex-grow font-zen',
          wrapper: 'justify-between no-underline rounded-sm',
        }}
      >
        <DropdownItem className="border-b border-primary/10 pb-4" isReadOnly showDivider={false}>
          <div className="flex w-full flex-col gap-2">
            <AccountWithENS address={address} />
          </div>
        </DropdownItem>

        <DropdownItem
          key="copy"
          onClick={handleCopyAddress}
          endContent={<CopyIcon className="h-4 w-4" />}
        >
          Copy Address
        </DropdownItem>

        <DropdownItem
          key="explorer"
          endContent={<ExternalLinkIcon className="h-4 w-4" />}
          onClick={() => window.open(getExplorerURL(address, chainId ?? 1), '_blank')}
        >
          View on Explorer
        </DropdownItem>

        <DropdownItem
          key="logout"
          onClick={handleDisconnectWallet}
          endContent={<ExitIcon className="h-4 w-4" />}
          className="text-red-500 data-[hover=true]:text-red-500"
        >
          Log out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

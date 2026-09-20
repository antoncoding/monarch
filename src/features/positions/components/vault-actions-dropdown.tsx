'use client';

import type React from 'react';
import { useRouter } from 'next/navigation';
import { IoEllipsisVertical } from 'react-icons/io5';
import { ArrowTopRightIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { getMonarchVaultHref } from '@/utils/vaults';

type VaultActionsDropdownProps = {
  vaultAddress: string;
  chainId: number;
};

export function VaultActionsDropdown({ vaultAddress, chainId }: VaultActionsDropdownProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation on keyboard events too
    e.stopPropagation();
  };

  const handleViewClick = () => {
    router.push(getMonarchVaultHref(chainId, vaultAddress));
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={-1}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="xs"
            variant="surface"
            className="text-xs"
            aria-label="Vault actions"
          >
            <IoEllipsisVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleViewClick}
            startContent={<ArrowTopRightIcon className="h-4 w-4" />}
          >
            View vault
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

'use client';

import type React from 'react';
import { useRouter } from 'next/navigation';
import { GoHistory } from 'react-icons/go';
import { IoEllipsisVertical } from 'react-icons/io5';
import { MdOutlineSettings } from 'react-icons/md';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

type VaultActionsDropdownProps = {
  vaultAddress: string;
  chainId: number;
  account: string;
};

export function VaultActionsDropdown({ vaultAddress, chainId, account }: VaultActionsDropdownProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation on keyboard events too
    e.stopPropagation();
  };

  const handleManageClick = () => {
    router.push(`/autovault/${chainId}/${vaultAddress}`);
  };

  const handleHistoryClick = () => {
    const historyUrl = `/history/${account}?chainId=${chainId}`;
    router.push(historyUrl);
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
          >
            <IoEllipsisVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleManageClick}
            startContent={<MdOutlineSettings className="h-4 w-4" />}
          >
            Manage
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleHistoryClick}
            startContent={<GoHistory className="h-4 w-4" />}
          >
            History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

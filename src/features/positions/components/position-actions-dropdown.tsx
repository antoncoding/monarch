'use client';

import type React from 'react';
import { TbArrowsRightLeft } from 'react-icons/tb';
import { IoEllipsisVertical } from 'react-icons/io5';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { Address } from 'viem';
import { SwitchPositionAccountMenuItem } from './switch-position-account-menu-item';

type PositionActionsDropdownProps = {
  isOwner: boolean;
  account: Address;
  onRebalanceClick: () => void;
};

export function PositionActionsDropdown({ isOwner, account, onRebalanceClick }: PositionActionsDropdownProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
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
          {isOwner ? (
            <DropdownMenuItem
              onClick={onRebalanceClick}
              startContent={<TbArrowsRightLeft className="h-4 w-4" />}
            >
              Rebalance
            </DropdownMenuItem>
          ) : (
            <SwitchPositionAccountMenuItem account={account} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

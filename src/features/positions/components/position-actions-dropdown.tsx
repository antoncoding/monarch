'use client';

import type React from 'react';
import { TbArrowsRightLeft } from 'react-icons/tb';
import { BsArrowUpRightCircle } from 'react-icons/bs';
import { IoEllipsisVertical } from 'react-icons/io5';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

type PositionActionsDropdownProps = {
  isOwner: boolean;
  onGroupedActionClick: () => void;
  onRebalanceClick: () => void;
};

export function PositionActionsDropdown({ isOwner, onGroupedActionClick, onRebalanceClick }: PositionActionsDropdownProps) {
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
            onClick={onGroupedActionClick}
            startContent={<BsArrowUpRightCircle className="h-4 w-4" />}
            disabled={!isOwner}
            className={isOwner ? '' : 'cursor-not-allowed opacity-50'}
          >
            Withdraw / Transfer
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onRebalanceClick}
            startContent={<TbArrowsRightLeft className="h-4 w-4" />}
            disabled={!isOwner}
            className={isOwner ? '' : 'cursor-not-allowed opacity-50'}
          >
            Rebalance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

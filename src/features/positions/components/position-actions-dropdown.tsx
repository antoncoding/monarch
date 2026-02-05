'use client';

import type React from 'react';
import { TbArrowsRightLeft } from 'react-icons/tb';
import { IoEllipsisVertical } from 'react-icons/io5';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

type PositionActionsDropdownProps = {
  isOwner: boolean;
  onRebalanceClick: () => void;
};

export function PositionActionsDropdown({ isOwner, onRebalanceClick }: PositionActionsDropdownProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation on keyboard events too
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
          <DropdownMenuItem
            onClick={onRebalanceClick}
            startContent={<TbArrowsRightLeft className="h-4 w-4" />}
            disabled={!isOwner}
            className={isOwner ? '' : 'opacity-50 cursor-not-allowed'}
          >
            Rebalance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

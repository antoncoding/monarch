'use client';

import type React from 'react';
import { TbArrowsRightLeft, TbTargetArrow } from 'react-icons/tb';
import { IoEllipsisVertical } from 'react-icons/io5';
import { GearIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

type PositionActionsDropdownProps = {
  isOwner?: boolean;
  onRebalanceClick: () => void;
  onSmartRebalanceClick: () => void;
  onSmartRebalanceConfigClick: () => void;
};

export function PositionActionsDropdown({ onRebalanceClick, onSmartRebalanceClick, onSmartRebalanceConfigClick }: PositionActionsDropdownProps) {
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
          <DropdownMenuItem
            onClick={onRebalanceClick}
            startContent={<TbArrowsRightLeft className="h-4 w-4" />}
          >
            Rebalance
          </DropdownMenuItem>
          <div className="flex items-stretch">
            <DropdownMenuItem
              onClick={onSmartRebalanceClick}
              startContent={<TbTargetArrow className="h-4 w-4" />}
              className="flex-1 rounded-r-none"
            >
              Smart Rebalance
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onSmartRebalanceConfigClick}
              className="rounded-l-none border-l border-border/30 px-2.5"
              aria-label="Open configuration"
            >
              <GearIcon className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

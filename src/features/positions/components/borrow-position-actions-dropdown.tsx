'use client';

import type React from 'react';
import { IoEllipsisVertical } from 'react-icons/io5';
import { BsArrowDownLeftCircle, BsArrowUpRightCircle } from 'react-icons/bs';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type BorrowPositionActionsDropdownProps = {
  isOwner: boolean;
  isActiveDebt: boolean;
  onBorrowMoreClick: () => void;
  onRepayClick: () => void;
};

export function BorrowPositionActionsDropdown({
  isOwner,
  isActiveDebt,
  onBorrowMoreClick,
  onRepayClick,
}: BorrowPositionActionsDropdownProps) {
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
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
            onClick={onBorrowMoreClick}
            startContent={<BsArrowDownLeftCircle className="h-4 w-4" />}
            disabled={!isOwner}
            className={isOwner ? '' : 'cursor-not-allowed opacity-50'}
          >
            Borrow More
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onRepayClick}
            startContent={<BsArrowUpRightCircle className="h-4 w-4" />}
            disabled={!isOwner}
            className={isOwner ? '' : 'cursor-not-allowed opacity-50'}
          >
            {isActiveDebt ? 'Repay' : 'Manage'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

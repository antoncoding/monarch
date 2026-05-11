'use client';

import type React from 'react';
import { BsArrowDownCircle, BsArrowUpCircle } from 'react-icons/bs';
import { IoEllipsisVertical } from 'react-icons/io5';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useModalStore } from '@/stores/useModalStore';
import type { MarketPositionWithEarnings } from '@/utils/types';

type SuppliedMarketPositionActionsDropdownProps = {
  position: MarketPositionWithEarnings;
  isOwner: boolean;
  isActiveSupply: boolean;
  refetch: (onSuccess?: () => void) => Promise<void>;
};

export function SuppliedMarketPositionActionsDropdown({
  position,
  isOwner,
  isActiveSupply,
  refetch,
}: SuppliedMarketPositionActionsDropdownProps) {
  const { open } = useModalStore();
  const canWithdraw = isOwner && isActiveSupply;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const handleWithdrawClick = () => {
    open('supply', {
      market: position.market,
      position,
      defaultMode: 'withdraw',
      refetch: () => {
        void refetch();
      },
    });
  };

  const handleDepositClick = () => {
    open('supply', {
      market: position.market,
      position,
      defaultMode: 'supply',
      refetch: () => {
        void refetch();
      },
    });
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
            aria-label="Position actions"
          >
            <IoEllipsisVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleWithdrawClick}
            startContent={<BsArrowDownCircle className="h-4 w-4" />}
            disabled={!canWithdraw}
            className={canWithdraw ? '' : 'cursor-not-allowed opacity-50'}
          >
            Withdraw
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDepositClick}
            startContent={<BsArrowUpCircle className="h-4 w-4" />}
          >
            Deposit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

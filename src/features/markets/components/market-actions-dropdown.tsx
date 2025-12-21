'use client';

import type React from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AiOutlineStop } from 'react-icons/ai';
import { GoStarFill, GoStar, GoGraph } from 'react-icons/go';
import { IoEllipsisVertical } from 'react-icons/io5';
import { TbArrowUp } from 'react-icons/tb';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { Market } from '@/utils/types';
import { BlacklistConfirmationModal } from './blacklist-confirmation-modal';

type MarketActionsDropdownProps = {
  market: Market;
  isStared: boolean;
  starMarket: (id: string) => void;
  unstarMarket: (id: string) => void;
  setSelectedMarket: (market: Market) => void;
  setShowSupplyModal: (show: boolean) => void;
  addBlacklistedMarket?: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  isBlacklisted?: (uniqueKey: string) => boolean;
};

export function MarketActionsDropdown({
  market,
  isStared,
  starMarket,
  unstarMarket,
  setSelectedMarket,
  setShowSupplyModal,
  addBlacklistedMarket,
  isBlacklisted,
}: MarketActionsDropdownProps) {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation on keyboard events too
    e.stopPropagation();
  };

  const handleBlacklistClick = () => {
    if (!isBlacklisted?.(market.uniqueKey) && addBlacklistedMarket) {
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmBlacklist = () => {
    if (addBlacklistedMarket) {
      addBlacklistedMarket(market.uniqueKey, market.morphoBlue.chain.id);
    }
  };

  const onMarketClick = () => {
    const marketPath = `/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`;
    router.push(marketPath);
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
            onClick={() => {
              setSelectedMarket(market);
              setShowSupplyModal(true);
            }}
            startContent={<TbArrowUp className="h-4 w-4" />}
          >
            Supply
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onMarketClick}
            startContent={<GoGraph className="h-4 w-4" />}
          >
            View Market
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              if (isStared) {
                unstarMarket(market.uniqueKey);
              } else {
                starMarket(market.uniqueKey);
              }
            }}
            startContent={isStared ? <GoStarFill className="h-4 w-4" /> : <GoStar className="h-4 w-4" />}
          >
            {isStared ? 'Unstar' : 'Star'}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleBlacklistClick}
            startContent={<AiOutlineStop className="h-4 w-4" />}
            className={isBlacklisted?.(market.uniqueKey) || !addBlacklistedMarket ? 'opacity-50 cursor-not-allowed' : ''}
            disabled={isBlacklisted?.(market.uniqueKey) || !addBlacklistedMarket}
          >
            {isBlacklisted?.(market.uniqueKey) ? 'Blacklisted' : 'Blacklist'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BlacklistConfirmationModal
        isOpen={isConfirmModalOpen}
        onOpenChange={setIsConfirmModalOpen}
        onConfirm={handleConfirmBlacklist}
        market={market}
      />
    </div>
  );
}

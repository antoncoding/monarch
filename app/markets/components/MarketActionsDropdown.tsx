import React, { useState } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { GoStarFill, GoStar, GoGraph } from 'react-icons/go';
import { TbArrowUp } from 'react-icons/tb';
import { AiOutlineStop } from 'react-icons/ai';
import { IoEllipsisVertical } from 'react-icons/io5';
import { Button } from '@/components/common/Button';
import { Market } from '@/utils/types';
import { BlacklistConfirmationModal } from './BlacklistConfirmationModal';

type MarketActionsDropdownProps = {
  market: Market;
  isStared: boolean;
  starMarket: (id: string) => void;
  unstarMarket: (id: string) => void;
  onMarketClick: (market: Market) => void;
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
  onMarketClick,
  setSelectedMarket,
  setShowSupplyModal,
  addBlacklistedMarket,
  isBlacklisted,
}: MarketActionsDropdownProps) {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
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

  return (
    <div onClick={handleClick}>
      <Dropdown className="rounded-sm">
        <DropdownTrigger>
          <Button
            size="xs"
            variant="interactive"
            className="text-xs"
            isIconOnly
          >
            <IoEllipsisVertical className="h-3 w-3" />
          </Button>
        </DropdownTrigger>
      <DropdownMenu
        aria-label="Market actions"
        itemClasses={{
          base: [
            'gap-4 px-4 py-2 rounded-none font-zen',
            'data-[hover=true]:bg-hovered rounded-sm',
          ].join(' '),
          title: 'text-sm text-primary flex-grow font-zen',
          wrapper: 'justify-between no-underline rounded-sm',
        }}
      >
        <DropdownItem
          key="supply"
          onClick={() => {
            setSelectedMarket(market);
            setShowSupplyModal(true);
          }}
          startContent={<TbArrowUp className="h-4 w-4" />}
        >
          Supply
        </DropdownItem>

        <DropdownItem
          key="view"
          onClick={() => {
            onMarketClick(market);
          }}
          startContent={<GoGraph className="h-4 w-4" />}
        >
          View Market
        </DropdownItem>

        <DropdownItem
          key="star"
          onClick={() => {
            if (isStared) {
              unstarMarket(market.uniqueKey);
            } else {
              starMarket(market.uniqueKey);
            }
          }}
          startContent={
            isStared ? (
              <GoStarFill className="h-4 w-4" />
            ) : (
              <GoStar className="h-4 w-4" />
            )
          }
        >
          {isStared ? 'Unstar' : 'Star'}
        </DropdownItem>

        <DropdownItem
          key="blacklist"
          onClick={handleBlacklistClick}
          startContent={<AiOutlineStop className="h-4 w-4" />}
          className={
            isBlacklisted?.(market.uniqueKey) || !addBlacklistedMarket
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }
          isDisabled={isBlacklisted?.(market.uniqueKey) || !addBlacklistedMarket}
        >
          {isBlacklisted?.(market.uniqueKey) ? 'Blacklisted' : 'Blacklist'}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>

    <BlacklistConfirmationModal
      isOpen={isConfirmModalOpen}
      onClose={() => setIsConfirmModalOpen(false)}
      onConfirm={handleConfirmBlacklist}
      market={market}
    />
    </div>
  );
}

'use client';

import type React from 'react';
import { useRouter } from 'next/navigation';
import { GoHistory } from 'react-icons/go';
import { TbReport, TbArrowsRightLeft } from 'react-icons/tb';
import { IoEllipsisVertical } from 'react-icons/io5';
import { FiExternalLink } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

type PositionActionsDropdownProps = {
  account: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  isOwner: boolean;
  onRebalanceClick: () => void;
};

export function PositionActionsDropdown({
  account,
  chainId,
  tokenAddress,
  tokenSymbol,
  isOwner,
  onRebalanceClick,
}: PositionActionsDropdownProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation on keyboard events too
    e.stopPropagation();
  };

  const handleHistoryClick = () => {
    const historyUrl = `/history/${account}?chainId=${chainId}&tokenAddress=${tokenAddress}`;
    router.push(historyUrl);
  };

  const handleViewReport = () => {
    const reportUrl = `/positions/report/${account}?chainId=${chainId}&tokenAddress=${tokenAddress}`;
    router.push(reportUrl);
  };

  const handleViewDetails = () => {
    const detailsUrl = `/position/${chainId}/${tokenSymbol}/${account}`;
    router.push(detailsUrl);
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

          <DropdownMenuItem
            onClick={handleHistoryClick}
            startContent={<GoHistory className="h-4 w-4" />}
          >
            History
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleViewReport}
            startContent={<TbReport className="h-4 w-4" />}
          >
            View Report
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleViewDetails}
            startContent={<FiExternalLink className="h-4 w-4" />}
          >
            View Details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

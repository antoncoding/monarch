'use client';

import { useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { LuCopy } from 'react-icons/lu';
import { GoGraph } from 'react-icons/go';
import { useStyledToast } from '@/hooks/useStyledToast';

type MarketIdActionsPopoverProps = {
  marketId: string;
  chainId: number;
  children: ReactNode;
};

/**
 * Dropdown menu showing market ID actions:
 * - Copy ID
 * - View Market
 */
export function MarketIdActionsPopover({ marketId, chainId, children }: MarketIdActionsPopoverProps) {
  const toast = useStyledToast();
  const router = useRouter();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(marketId);
      toast.success('Market ID copied', `${marketId.slice(0, 10)}...${marketId.slice(-6)}`);
    } catch (error) {
      console.error('Failed to copy market ID', error);
    }
  }, [marketId, toast]);

  const handleViewMarket = useCallback(() => {
    router.push(`/market/${chainId}/${marketId}`);
  }, [chainId, marketId, router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => void handleCopy()}
          startContent={<LuCopy className="h-4 w-4" />}
        >
          Copy ID
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleViewMarket}
          startContent={<GoGraph className="h-4 w-4" />}
        >
          View Market
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

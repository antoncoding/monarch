'use client';

import { Button } from '@/components/ui/button';
import { useModal } from '@/hooks/useModal';
import type { MarketPosition } from '@/utils/types';

type MarketActionsCellProps = {
  position: MarketPosition;
  isOwner: boolean;
};

export function MarketActionsCell({ position, isOwner }: MarketActionsCellProps) {
  const { open } = useModal();

  if (!isOwner) {
    return <span className="text-xs text-secondary">-</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="surface"
        onClick={(e) => {
          e.stopPropagation();
          open('supply', {
            market: position.market,
            position,
            defaultMode: 'withdraw',
          });
        }}
      >
        Withdraw
      </Button>
      <Button
        size="sm"
        variant="surface"
        onClick={(e) => {
          e.stopPropagation();
          open('supply', {
            market: position.market,
            position,
          });
        }}
      >
        Supply
      </Button>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import type { DetailView } from '../constants';

type MarketsPanelProps = {
  onNavigateToDetail: (view: DetailView) => void;
};

export function MarketsPanel({ onNavigateToDetail }: MarketsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-primary">Manage Blacklisted Markets</h3>
          <p className="text-xs text-secondary">
            Block specific markets from appearing in your view. Blacklisted markets are completely hidden from all lists.
          </p>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => onNavigateToDetail('blacklisted-markets')}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { BorrowModal } from '@/modals/borrow/borrow-modal';
import { Button } from '@/components/ui/button';
import {
  createUiLabBorrowPositionFixture,
  createUiLabMarketFixture,
  uiLabLiquiditySourcingFixture,
  uiLabOraclePrice,
} from '@/features/ui-lab/fixtures/market-fixtures';

export function BorrowModalHarness(): JSX.Element {
  const [isOpen, setIsOpen] = useState(true);
  const [defaultMode, setDefaultMode] = useState<'borrow' | 'repay'>('borrow');
  const [hasPosition, setHasPosition] = useState(true);

  const market = useMemo(() => createUiLabMarketFixture(), []);
  const position = useMemo(() => (hasPosition ? createUiLabBorrowPositionFixture(market) : null), [hasPosition, market]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setIsOpen(true)}>
          Open Borrow Modal
        </Button>
        <Button variant={defaultMode === 'borrow' ? 'surface' : 'ghost'} size="sm" onClick={() => setDefaultMode('borrow')}>
          Borrow Mode
        </Button>
        <Button variant={defaultMode === 'repay' ? 'surface' : 'ghost'} size="sm" onClick={() => setDefaultMode('repay')}>
          Repay Mode
        </Button>
        <Button variant={hasPosition ? 'surface' : 'ghost'} size="sm" onClick={() => setHasPosition((prev) => !prev)}>
          {hasPosition ? 'With Position' : 'No Position'}
        </Button>
      </div>

      <p className="text-sm text-secondary">Use this harness to adjust real `BorrowModal` spacing/layout with deterministic fixture props.</p>

      {isOpen ? (
        <BorrowModal
          key={`${defaultMode}-${hasPosition ? 'with-position' : 'no-position'}`}
          market={market}
          onOpenChange={setIsOpen}
          oraclePrice={uiLabOraclePrice}
          refetch={() => {}}
          isRefreshing={false}
          position={position}
          defaultMode={defaultMode}
          liquiditySourcing={uiLabLiquiditySourcingFixture}
        />
      ) : null}
    </div>
  );
}

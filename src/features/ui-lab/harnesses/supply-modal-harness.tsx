'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SupplyModalV2 } from '@/modals/supply/supply-modal';
import {
  createUiLabMarketFixture,
  createUiLabSupplyPositionFixture,
  uiLabLiquiditySourcingFixture,
} from '@/features/ui-lab/fixtures/market-fixtures';

export function SupplyModalHarness(): JSX.Element {
  const [isOpen, setIsOpen] = useState(true);
  const [defaultMode, setDefaultMode] = useState<'supply' | 'withdraw'>('supply');
  const [hasPosition, setHasPosition] = useState(true);

  const market = useMemo(() => createUiLabMarketFixture(), []);
  const position = useMemo(() => (hasPosition ? createUiLabSupplyPositionFixture(market) : null), [hasPosition, market]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setIsOpen(true)}>
          Open Supply Modal
        </Button>
        <Button variant={defaultMode === 'supply' ? 'surface' : 'ghost'} size="sm" onClick={() => setDefaultMode('supply')}>
          Supply Mode
        </Button>
        <Button variant={defaultMode === 'withdraw' ? 'surface' : 'ghost'} size="sm" onClick={() => setDefaultMode('withdraw')}>
          Withdraw Mode
        </Button>
        <Button variant={hasPosition ? 'surface' : 'ghost'} size="sm" onClick={() => setHasPosition((prev) => !prev)}>
          {hasPosition ? 'With Position' : 'No Position'}
        </Button>
      </div>

      <p className="text-sm text-secondary">Use this harness to tune `SupplyModalV2` layout while keeping market/position fixtures stable.</p>

      {isOpen ? (
        <SupplyModalV2
          key={`${defaultMode}-${hasPosition ? 'with-position' : 'no-position'}`}
          market={market}
          position={position}
          onOpenChange={setIsOpen}
          refetch={() => {}}
          defaultMode={defaultMode}
          liquiditySourcing={uiLabLiquiditySourcingFixture}
        />
      ) : null}
    </div>
  );
}

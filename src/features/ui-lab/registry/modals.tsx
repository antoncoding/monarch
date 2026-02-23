import type { UiLabEntry } from '@/features/ui-lab/types';
import { BorrowModalHarness } from '@/features/ui-lab/harnesses/borrow-modal-harness';
import { MarketSelectionModalHarness } from '@/features/ui-lab/harnesses/market-harnesses';
import { SupplyModalHarness } from '@/features/ui-lab/harnesses/supply-modal-harness';

export const modalEntries: UiLabEntry[] = [
  {
    id: 'borrow-modal',
    title: 'Borrow Modal',
    category: 'modals',
    dataMode: 'hybrid',
    description: 'Real BorrowModal with deterministic market/position fixtures.',
    render: () => <BorrowModalHarness />,
    defaultCanvas: {
      maxW: 1200,
      pad: 24,
      bg: 'surface',
    },
  },
  {
    id: 'market-selection-modal',
    title: 'Market Selection Modal',
    category: 'modals',
    dataMode: 'live',
    description: 'Live market selection modal from the app workflow.',
    render: () => <MarketSelectionModalHarness />,
    defaultCanvas: {
      maxW: 1280,
      pad: 24,
      bg: 'surface',
    },
  },
  {
    id: 'supply-modal',
    title: 'Supply Modal',
    category: 'modals',
    dataMode: 'hybrid',
    description: 'Real SupplyModalV2 with deterministic market/position fixtures.',
    render: () => <SupplyModalHarness />,
    defaultCanvas: {
      maxW: 1200,
      pad: 24,
      bg: 'surface',
    },
  },
];

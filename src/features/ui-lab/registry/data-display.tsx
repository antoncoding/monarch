import type { UiLabEntry } from '@/features/ui-lab/types';
import { MarketDetailsBlockHarness, MarketSelectorHarness } from '@/features/ui-lab/harnesses/market-harnesses';
import { SectionTagHarness, TableContainerWithHeaderHarness, TablePaginationHarness } from '@/features/ui-lab/harnesses/shared-harnesses';

export const dataDisplayEntries: UiLabEntry[] = [
  {
    id: 'section-tag',
    title: 'Section Tag',
    category: 'data-display',
    dataMode: 'fixture',
    description: 'Bracketed section labels used in landing surfaces.',
    render: () => <SectionTagHarness />,
  },
  {
    id: 'market-selector',
    title: 'Market Selector',
    category: 'data-display',
    dataMode: 'fixture',
    description: 'Single market row selector card used in selection flows.',
    render: () => <MarketSelectorHarness />,
  },
  {
    id: 'market-details-block',
    title: 'Market Details Block',
    category: 'data-display',
    dataMode: 'hybrid',
    description: 'Collapsible market details with supply/borrow preview states.',
    render: () => <MarketDetailsBlockHarness />,
  },
  {
    id: 'table-container-header',
    title: 'Table Container Header',
    category: 'data-display',
    dataMode: 'fixture',
    description: 'Table container with title/actions and compact rows.',
    render: () => <TableContainerWithHeaderHarness />,
  },
  {
    id: 'table-pagination',
    title: 'Table Pagination',
    category: 'data-display',
    dataMode: 'fixture',
    description: 'Pagination control with page jump and entry count.',
    render: () => <TablePaginationHarness />,
  },
];

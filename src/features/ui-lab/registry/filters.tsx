import type { UiLabEntry } from '@/features/ui-lab/types';
import { AssetFilterHarness, NetworkFilterHarness } from '@/features/ui-lab/harnesses/market-harnesses';

export const filterEntries: UiLabEntry[] = [
  {
    id: 'network-filter',
    title: 'Network Filter',
    category: 'filters',
    description: 'Real network selection dropdown component with compact/default variants.',
    render: () => <NetworkFilterHarness />,
  },
  {
    id: 'asset-filter',
    title: 'Asset Filter',
    category: 'filters',
    description: 'Token multi-select filter using realistic supported token fixtures.',
    render: () => <AssetFilterHarness />,
  },
];

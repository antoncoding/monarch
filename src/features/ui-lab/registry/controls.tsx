import type { UiLabEntry } from '@/features/ui-lab/types';
import { DropdownMenuHarness, IconSwitchHarness, RefetchIconHarness, ToastHarness } from '@/features/ui-lab/harnesses/shared-harnesses';

export const controlEntries: UiLabEntry[] = [
  {
    id: 'icon-switch',
    title: 'Icon Switch',
    category: 'controls',
    dataMode: 'fixture',
    description: 'Plain and icon-thumb switch states and sizes.',
    render: () => <IconSwitchHarness />,
  },
  {
    id: 'refetch-icon',
    title: 'Refetch Icon',
    category: 'controls',
    dataMode: 'fixture',
    description: 'Smooth spinning reload icon behavior during fetch states.',
    render: () => <RefetchIconHarness />,
  },
  {
    id: 'dropdown-menu',
    title: 'Dropdown Menu',
    category: 'controls',
    dataMode: 'fixture',
    description: 'Menu items, checkbox items, and radio groups.',
    render: () => <DropdownMenuHarness />,
  },
  {
    id: 'toast',
    title: 'Toast',
    category: 'controls',
    dataMode: 'fixture',
    description: 'Styled success, error, and info toast triggers.',
    render: () => <ToastHarness />,
  },
];

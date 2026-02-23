import type { UiLabEntry } from '@/features/ui-lab/types';
import { MarketIdentityHarness } from '@/features/ui-lab/harnesses/market-harnesses';
import {
  AccountIdentityHarness,
  CollateralIconsDisplayHarness,
  TransactionIdentityHarness,
} from '@/features/ui-lab/harnesses/shared-harnesses';

export const identityEntries: UiLabEntry[] = [
  {
    id: 'account-identity',
    title: 'Account Identity',
    category: 'identity',
    dataMode: 'hybrid',
    description: 'Badge, compact, and full account identity variants.',
    render: () => <AccountIdentityHarness />,
  },
  {
    id: 'market-identity',
    title: 'Market Identity',
    category: 'identity',
    dataMode: 'hybrid',
    description: 'Market identity modes: focused, minimum, and badge.',
    render: () => <MarketIdentityHarness />,
  },
  {
    id: 'transaction-identity',
    title: 'Transaction Identity',
    category: 'identity',
    description: 'Explorer-linked transaction hash badges.',
    render: () => <TransactionIdentityHarness />,
  },
  {
    id: 'collateral-icons-display',
    title: 'Collateral Icons Display',
    category: 'identity',
    description: 'Overlapping collateral icons with overflow tooltip badge.',
    render: () => <CollateralIconsDisplayHarness />,
  },
];

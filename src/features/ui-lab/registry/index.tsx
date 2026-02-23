import type { UiLabCategory, UiLabDataMode, UiLabEntry } from '@/features/ui-lab/types';
import { controlEntries } from '@/features/ui-lab/registry/controls';
import { dataDisplayEntries } from '@/features/ui-lab/registry/data-display';
import { filterEntries } from '@/features/ui-lab/registry/filters';
import { identityEntries } from '@/features/ui-lab/registry/identity';
import { modalEntries } from '@/features/ui-lab/registry/modals';
import { primitiveEntries } from '@/features/ui-lab/registry/primitives';

const DEFAULT_DATA_MODE: UiLabDataMode = 'fixture';

const withDefaultDataMode = (entries: UiLabEntry[]): UiLabEntry[] => {
  return entries.map((entry) => ({
    ...entry,
    dataMode: entry.dataMode ?? DEFAULT_DATA_MODE,
  }));
};

const assertUniqueEntryIds = (entries: UiLabEntry[]): void => {
  const seen = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate UI Lab entry id detected: "${entry.id}"`);
    }
    seen.add(entry.id);
  }
};

const registrySections: UiLabEntry[][] = [
  primitiveEntries,
  filterEntries,
  identityEntries,
  dataDisplayEntries,
  controlEntries,
  modalEntries,
];

const flatEntries = registrySections.flat();
assertUniqueEntryIds(flatEntries);

export const uiLabRegistry: UiLabEntry[] = withDefaultDataMode(flatEntries);

export const uiLabCategoryOrder: UiLabCategory[] = ['ui-primitives', 'filters', 'identity', 'data-display', 'controls', 'modals'];

export const uiLabCategoryLabel: Record<UiLabCategory, string> = {
  'ui-primitives': 'UI Primitives',
  filters: 'Filters & Selection',
  identity: 'Identity',
  'data-display': 'Data Display',
  controls: 'Controls',
  modals: 'Modals',
};

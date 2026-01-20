'use client';

import { cn } from '@/utils/components';
import { VAULT_SETTINGS_CATEGORIES, type CategoryConfig } from './constants';
import type { VaultSettingsCategory } from '@/stores/vault-settings-modal-store';

type VaultSettingsSidebarProps = {
  selectedCategory: VaultSettingsCategory;
  onSelectCategory: (category: VaultSettingsCategory) => void;
  disabled?: boolean;
};

function CategoryButton({
  cat,
  isSelected,
  disabled,
  onClick,
}: {
  cat: CategoryConfig;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = cat.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 rounded px-3 py-2.5 text-left transition-colors',
        isSelected ? 'bg-surface text-primary' : 'text-secondary hover:bg-surface/50 hover:text-primary',
      )}
      aria-current={isSelected ? 'page' : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-monospace text-[11px] uppercase tracking-wide">{cat.label}</span>
    </button>
  );
}

export function VaultSettingsSidebar({ selectedCategory, onSelectCategory, disabled }: VaultSettingsSidebarProps) {
  return (
    <div
      className={cn(
        'flex w-[180px] shrink-0 flex-col rounded-l-xl border-r border-border bg-surface-soft',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {/* Header spacer - height matches VaultSettingsHeader */}
      <div className="h-14 border-b border-border" />

      {/* Category list */}
      <nav className="flex flex-col gap-1 overflow-y-auto p-2">
        {VAULT_SETTINGS_CATEGORIES.map((cat) => (
          <CategoryButton
            key={cat.id}
            cat={cat}
            isSelected={selectedCategory === cat.id}
            disabled={disabled}
            onClick={() => onSelectCategory(cat.id)}
          />
        ))}
      </nav>
    </div>
  );
}

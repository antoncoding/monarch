'use client';

import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { cn } from '@/utils/components';
import { SETTINGS_CATEGORIES, type SettingsCategory, type CategoryConfig } from './constants';

type SettingsSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  selectedCategory: SettingsCategory;
  onSelectCategory: (category: SettingsCategory) => void;
  disabled?: boolean;
};

function CategoryButton({
  cat,
  isSelected,
  collapsed,
  disabled,
  onClick,
}: {
  cat: CategoryConfig;
  isSelected: boolean;
  collapsed: boolean;
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
      {!collapsed && (
        <div className="flex items-center gap-1.5">
          <span className="font-monospace text-[11px] uppercase tracking-wide">{cat.label}</span>
          {cat.badge && (
            <span className="shrink-0 rounded-sm bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-medium text-orange-500">{cat.badge}</span>
          )}
        </div>
      )}
    </button>
  );
}

export function SettingsSidebar({ collapsed, onToggle, selectedCategory, onSelectCategory, disabled }: SettingsSidebarProps) {
  return (
    <motion.div
      className={cn('flex flex-col rounded-l-xl border-r border-border bg-surface-soft', disabled && 'pointer-events-none opacity-50')}
      animate={{ width: collapsed ? 56 : 180 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      {/* Toggle button - height matches SettingsHeader */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex h-14 items-center justify-end border-b border-border px-4 text-secondary transition-colors hover:text-primary"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
      </button>

      {/* Category list */}
      <nav className="flex flex-col gap-1 overflow-y-auto p-2">
        {SETTINGS_CATEGORIES.map((cat) => (
          <CategoryButton
            key={cat.id}
            cat={cat}
            isSelected={selectedCategory === cat.id}
            collapsed={collapsed}
            disabled={disabled}
            onClick={() => onSelectCategory(cat.id)}
          />
        ))}
      </nav>
    </motion.div>
  );
}

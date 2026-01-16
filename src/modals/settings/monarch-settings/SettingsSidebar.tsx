'use client';

import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { cn } from '@/utils/components';
import { SETTINGS_CATEGORIES, type SettingsCategory } from './constants';

type SettingsSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  selectedCategory: SettingsCategory;
  onSelectCategory: (category: SettingsCategory) => void;
  disabled?: boolean;
};

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
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {SETTINGS_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-3 rounded px-3 py-2.5 text-left transition-colors',
                isSelected ? 'bg-surface text-primary' : 'text-secondary hover:bg-surface/50 hover:text-primary',
              )}
              aria-current={isSelected ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="font-monospace text-[11px] uppercase tracking-wide">{cat.label}</span>
                  {cat.badge && (
                    <span className="ml-auto rounded-sm bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-medium text-orange-500">
                      {cat.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>
    </motion.div>
  );
}

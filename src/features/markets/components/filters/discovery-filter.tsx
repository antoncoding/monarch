'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import { FaRegLightbulb } from 'react-icons/fa';
import { HiFire } from 'react-icons/hi2';
import { LuUser } from 'react-icons/lu';
import {
  MARKET_DISCOVERY_CATEGORIES,
  MARKET_DISCOVERY_CATEGORY_META,
  type MarketDiscoveryCategory,
} from '@/features/markets/market-discovery';
import { useMarketDiscoveryFlagsQuery } from '@/hooks/queries/useMarketDiscoveryFlagsQuery';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { cn } from '@/utils/components';

const CATEGORY_ICONS: Record<MarketDiscoveryCategory, ReactNode> = {
  newOpportunities: <FaRegLightbulb className="h-3.5 w-3.5" />,
  trending: <HiFire className="h-3.5 w-3.5" />,
  popular: <LuUser className="h-3.5 w-3.5" />,
};

type DiscoveryFilterProps = {
  showLabelPrefix?: boolean;
};

export default function DiscoveryFilter({ showLabelPrefix = false }: DiscoveryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const discoveryCategories = useMarketsFilters((state) => state.discoveryCategories);
  const toggleDiscoveryCategory = useMarketsFilters((state) => state.toggleDiscoveryCategory);
  const clearDiscoveryCategories = useMarketsFilters((state) => state.clearDiscoveryCategories);
  const { data, isLoading } = useMarketDiscoveryFlagsQuery({ defer: true });
  const selectedCategorySet = new Set(discoveryCategories);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const clearSelection = () => {
    clearDiscoveryCategories();
    setIsOpen(false);
  };

  const selectedCategory = discoveryCategories[0];
  const selectedLabel =
    discoveryCategories.length === 1 && selectedCategory
      ? MARKET_DISCOVERY_CATEGORY_META[selectedCategory].shortLabel
      : `${discoveryCategories.length} selected`;

  return (
    <div
      className="relative font-zen"
      ref={dropdownRef}
    >
      <button
        type="button"
        className={cn(
          'bg-surface flex h-10 items-center gap-2 rounded-sm border border-transparent px-3 shadow-sm transition-all duration-200 hover:bg-hovered',
          'min-w-[132px] max-w-[220px]',
          isOpen && 'min-w-[190px]',
          discoveryCategories.length > 0 && 'border-orange-500/45',
        )}
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-1 items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {showLabelPrefix && <span className="text-secondary">Discovery:</span>}
            {isLoading ? (
              <span className="text-secondary">Loading...</span>
            ) : discoveryCategories.length > 0 ? (
              <span className="text-primary">{selectedLabel}</span>
            ) : (
              <span className="text-secondary">All</span>
            )}
          </div>
        </div>
        <ChevronDownIcon className={cn('h-4 w-4 text-secondary transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      <div
        className={cn(
          'bg-surface absolute z-50 mt-1 w-full min-w-[220px] rounded-sm shadow-lg transition-all duration-200',
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
        )}
      >
        <div className="relative">
          <ul
            className={cn('custom-scrollbar max-h-60 overflow-auto', discoveryCategories.length > 0 && 'pb-10')}
            role="listbox"
          >
            {MARKET_DISCOVERY_CATEGORIES.map((category) => {
              const meta = MARKET_DISCOVERY_CATEGORY_META[category];
              const isSelected = selectedCategorySet.has(category);
              const count = data?.flags[category]?.length ?? 0;

              return (
                <li
                  key={category}
                  className={cn(
                    'm-2 flex cursor-pointer items-center justify-between rounded border border-transparent p-2 text-sm transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800',
                    isSelected && 'border-orange-500/40 dark:border-orange-500/45',
                  )}
                  onClick={() => toggleDiscoveryCategory(category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      toggleDiscoveryCategory(category);
                    }
                  }}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2">
                    <span className={isSelected ? 'text-orange-500' : 'text-secondary'}>{CATEGORY_ICONS[category]}</span>
                    <span>{meta.label}</span>
                  </div>
                  <span className="font-monospace text-[11px] text-secondary">{isLoading ? '...' : count}</span>
                </li>
              );
            })}
          </ul>
          {discoveryCategories.length > 0 && (
            <div className="bg-surface absolute bottom-0 left-0 right-0 p-1.5">
              <button
                className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-left text-xs text-secondary transition-colors duration-200 hover:text-normal"
                onClick={clearSelection}
                type="button"
              >
                <span>Clear All</span>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

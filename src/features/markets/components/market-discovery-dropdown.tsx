'use client';

import type { ReactNode } from 'react';
import { ChevronDownIcon, Cross2Icon } from '@radix-ui/react-icons';
import { FaRegLightbulb } from 'react-icons/fa';
import { HiFire } from 'react-icons/hi2';
import { LuUser } from 'react-icons/lu';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MARKET_DISCOVERY_CATEGORIES,
  MARKET_DISCOVERY_CATEGORY_META,
  getMarketDiscoveryKey,
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

export function MarketDiscoveryDropdown() {
  const discoveryCategories = useMarketsFilters((state) => state.discoveryCategories);
  const toggleDiscoveryCategory = useMarketsFilters((state) => state.toggleDiscoveryCategory);
  const clearDiscoveryCategories = useMarketsFilters((state) => state.clearDiscoveryCategories);
  const { data, isLoading } = useMarketDiscoveryFlagsQuery({ defer: true });
  const activeCategories = new Set(discoveryCategories);
  const hasActiveCategories = discoveryCategories.length > 0;
  const activeCount = new Set(
    discoveryCategories.flatMap((category) =>
      (data?.flags[category] ?? []).map((flag) => getMarketDiscoveryKey(flag.chainId, flag.marketUniqueKey)),
    ),
  ).size;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Discovery"
          variant="ghost"
          size="sm"
          className={cn(
            'min-w-0 gap-1.5 px-2 text-secondary',
            hasActiveCategories && 'border border-orange-500/70 bg-orange-500/5 text-orange-500 hover:bg-orange-500/10',
          )}
        >
          <FaRegLightbulb className="h-3.5 w-3.5" />
          <span>Discovery</span>
          {hasActiveCategories && (
            <span className="rounded-sm bg-orange-500/15 px-1.5 py-0.5 font-monospace text-[10px] leading-none text-orange-500">
              {isLoading ? '...' : activeCount}
            </span>
          )}
          <ChevronDownIcon className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 p-2"
      >
        <DropdownMenuLabel className="px-2 py-1 text-xs text-secondary">Prioritize</DropdownMenuLabel>
        {MARKET_DISCOVERY_CATEGORIES.map((category) => {
          const meta = MARKET_DISCOVERY_CATEGORY_META[category];
          const count = data?.flags[category]?.length ?? 0;

          return (
            <DropdownMenuCheckboxItem
              key={category}
              checked={activeCategories.has(category)}
              onCheckedChange={() => toggleDiscoveryCategory(category)}
              onSelect={(event) => event.preventDefault()}
              startContent={<span className="text-orange-500">{CATEGORY_ICONS[category]}</span>}
              endContent={<span className="font-monospace text-[11px] text-secondary">{isLoading ? '...' : count}</span>}
              className="px-2"
            >
              {meta.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        {hasActiveCategories && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                clearDiscoveryCategories();
              }}
              startContent={<Cross2Icon className="h-3.5 w-3.5" />}
              className="px-2 text-secondary"
            >
              Turn off
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

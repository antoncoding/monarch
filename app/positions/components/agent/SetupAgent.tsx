import { useState, useMemo } from 'react';
import { Button } from '@nextui-org/react';
import { Market, MarketPosition } from '@/utils/types';
import { MarketCap } from '@/hooks/useAuthorizeAgent';
import { MarketInfoBlockCompact } from '@/components/common/MarketInfoBlock';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';

type MarketGroup = {
  loanAsset: {
    symbol: string;
    address: string;
  };
  chainId: number;
  markets: Market[];
};

type SetupAgentProps = {
  positions: MarketPosition[];
  allMarkets: Market[];
  selectedCaps: MarketCap[];
  onAddMarket: (market: Market) => void;
  onRemoveMarket: (market: Market) => void;
  onNext: () => void;
  onBack: () => void;
};

export function SetupAgent({
  positions,
  allMarkets,
  selectedCaps,
  onAddMarket,
  onRemoveMarket,
  onNext,
  onBack,
}: SetupAgentProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Get active positions (with positive supply)
  const activePositions = useMemo(() => {
    return positions?.filter((p) => BigInt(p.supplyShares) > 0) ?? [];
  }, [positions]);

  // Get unique loan assets from active positions
  const activeLoanAssets = useMemo(() => {
    const assets = new Set<string>();
    activePositions.forEach((position) => {
      assets.add(position.market.loanAsset.address.toLowerCase());
    });
    return Array.from(assets);
  }, [activePositions]);

  // Group markets by loan asset and chain, but only for active loan assets
  const groupedMarkets = useMemo(() => {
    const groups: { [key: string]: MarketGroup } = {};

    allMarkets.forEach((market) => {
      // Only include markets with loan assets that user has positions in
      if (!activeLoanAssets.includes(market.loanAsset.address.toLowerCase())) {
        return;
      }

      const key = `${market.loanAsset.address}-${market.morphoBlue.chain.id}`;
      if (!groups[key]) {
        groups[key] = {
          loanAsset: market.loanAsset,
          chainId: market.morphoBlue.chain.id,
          markets: [],
        };
      }
      groups[key].markets.push(market);
    });

    return Object.values(groups);
  }, [allMarkets, activeLoanAssets]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const isMarketSelected = (market: Market) =>
    selectedCaps.some((cap) => cap.market.uniqueKey === market.uniqueKey);

  if (groupedMarkets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-400 text-center">
          No active positions found. Please supply to some markets first before setting up the Monarch Agent.
        </p>
        <Button
          variant="light"
          onPress={onBack}
          className="mt-4"
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Groups */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 
        scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-100 
        dark:scrollbar-thumb-gray-500 dark:scrollbar-track-gray-800
        hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-400">
        {groupedMarkets.map((group) => {
          const groupKey = `${group.loanAsset.address}-${group.chainId}`;
          const isExpanded = expandedGroups.includes(groupKey);
          const selectedMarketsInGroup = group.markets.filter(isMarketSelected);

          return (
            <div
              key={groupKey}
              className="rounded-lg border border-divider bg-content1 overflow-hidden"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(groupKey)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-content2 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    {group.loanAsset.symbol} Markets
                  </span>
                  <span className="text-sm text-gray-500">
                    Chain ID: {group.chainId}
                  </span>
                  <span className="text-sm text-gray-500">
                    {selectedMarketsInGroup.length} market
                    {selectedMarketsInGroup.length !== 1 ? 's' : ''} monitored
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUpIcon className="h-5 w-5" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5" />
                )}
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 py-3 space-y-2 bg-background/50">
                      {group.markets.map((market) => {
                        const isSelected = isMarketSelected(market);
                        return (
                          <div
                            key={market.uniqueKey}
                            className="flex items-center justify-between"
                          >
                            <MarketInfoBlockCompact
                              market={market}
                              className="flex-1"
                            />
                            <Button
                              variant={isSelected ? "bordered" : "solid"}
                              color={isSelected ? "danger" : "primary"}
                              size="sm"
                              className="ml-4"
                              onClick={() =>
                                isSelected
                                  ? onRemoveMarket(market)
                                  : onAddMarket(market)
                              }
                            >
                              {isSelected ? "Remove" : "Add"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="light" onPress={onBack}>
          Back
        </Button>
        <Button
          variant="solid"
          color="primary"
          onPress={onNext}
          isDisabled={selectedCaps.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

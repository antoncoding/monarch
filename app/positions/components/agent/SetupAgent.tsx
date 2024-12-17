import { useState, useMemo, useCallback, useEffect } from 'react';
import { Checkbox } from '@nextui-org/react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { formatUnits } from 'viem';
import { AgentSetupProcessModal } from '@/components/AgentSetupProcessModal';
import { Button } from '@/components/common/Button';
import { MarketInfoBlockCompact } from '@/components/common/MarketInfoBlock';
import { MarketCap, useAuthorizeAgent } from '@/hooks/useAuthorizeAgent';
import { SupportedNetworks } from '@/utils/networks';
import { OracleVendorIcons, OracleVendors } from '@/utils/oracle';
import { findToken } from '@/utils/tokens';
import { Market, MarketPosition } from '@/utils/types';

type MarketGroup = {
  loanAsset: {
    address: string;
    symbol: string;
  };
  activeMarkets: Market[];
  historicalMarkets: Market[];
  otherMarkets: Market[];
};

type SetupAgentProps = {
  positions: MarketPosition[];
  allMarkets: Market[];
  selectedCaps: MarketCap[];
  onAddMarket: (market: Market) => void;
  onRemoveMarket: (market: Market) => void;
  onBack: () => void;
  onNext: () => void;
};

// Helper component for market rows
function MarketRow({
  market,
  isSelected,
  onToggle,
}: {
  market: Market;
  isSelected: boolean;
  onToggle: (selected: boolean) => void;
}) {
  return (
    <div className="group flex items-center justify-between rounded-lg px-2 py-1 hover:bg-content2">
      <div className="flex flex-1 items-center gap-3">
        <Checkbox
          isSelected={isSelected}
          onValueChange={onToggle}
          size="sm"
          color="primary"
          className="mr-0"
        />
        <MarketInfoBlockCompact market={market} className="flex-1" />
      </div>
    </div>
  );
}

export function SetupAgent({
  positions,
  allMarkets,
  selectedCaps,
  onAddMarket,
  onRemoveMarket,
  onBack,
  onNext,
}: SetupAgentProps) {
  const [hasPreselected, setHasPreselected] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);

  const isMarketSelected = (market: Market) =>
    selectedCaps.some((cap) => cap.market.uniqueKey === market.uniqueKey);

  // Group markets by loan asset and categorize them
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, MarketGroup> = {};

    // First, identify active loan assets from positions
    const activeLoanAssets = new Set<string>();
    positions.forEach((position) => {
      const supply = parseFloat(
        formatUnits(BigInt(position.supplyAssets), position.market.loanAsset.decimals),
      );
      if (supply > 0) {
        activeLoanAssets.add(position.market.loanAsset.address.toLowerCase());
      }
    });

    // Only process markets for active loan assets
    allMarkets.forEach((market) => {
      const loanAssetKey = market.loanAsset.address.toLowerCase();
      if (!activeLoanAssets.has(loanAssetKey)) return;

      if (!groups[loanAssetKey]) {
        groups[loanAssetKey] = {
          loanAsset: market.loanAsset,
          activeMarkets: [],
          historicalMarkets: [],
          otherMarkets: [],
        };
      }

      const position = positions.find((p) => p.market.uniqueKey === market.uniqueKey);
      if (position) {
        const supply = parseFloat(
          formatUnits(BigInt(position.supplyAssets), position.market.loanAsset.decimals),
        );
        if (supply > 0) {
          groups[loanAssetKey].activeMarkets.push(market);
        } else {
          groups[loanAssetKey].historicalMarkets.push(market);
        }
      } else {
        groups[loanAssetKey].otherMarkets.push(market);
      }
    });

    return Object.values(groups);
  }, [allMarkets, positions]);

  // Pre-select active markets only once when component mounts
  useEffect(() => {
    if (!hasPreselected && groupedMarkets.length > 0) {
      groupedMarkets.forEach((group) => {
        group.activeMarkets.forEach((market) => {
          if (!isMarketSelected(market)) {
            onAddMarket(market);
          }
        });
      });
      setHasPreselected(true);
    }
  }, [hasPreselected, groupedMarkets, isMarketSelected, onAddMarket]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const { executeBatchSetupAgent, currentStep } = useAuthorizeAgent(selectedCaps, onNext);

  const handleExecute = useCallback(() => {
    setShowProcessModal(true);
    void executeBatchSetupAgent(() => setShowProcessModal(false));
  }, [executeBatchSetupAgent]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between font-zen text-sm">
        Monarch Agent can only reallocate your positions to markets you authorize it to!
      </div>

      <div
        className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-100 
        dark:scrollbar-thumb-gray-500 dark:scrollbar-track-gray-800 
        hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-400 
        max-h-[400px] space-y-4 overflow-y-auto pr-2"
      >
        {groupedMarkets.map((group) => {
          const groupKey = group.loanAsset.address;
          const isExpanded = expandedGroups.includes(groupKey);
          const selectedMarketsCount = [
            ...group.activeMarkets,
            ...group.historicalMarkets,
            ...group.otherMarkets,
          ].filter(isMarketSelected).length;

          const loanAsset = findToken(group.loanAsset.address, SupportedNetworks.Base);
          const loanAssetImg = loanAsset?.img ?? OracleVendorIcons[OracleVendors.Unknown];

          return (
            <div
              key={groupKey}
              className="overflow-hidden rounded border border-divider bg-content1"
            >
              {showProcessModal && <AgentSetupProcessModal currentStep={currentStep} />}
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-content2"
              >
                <div className="flex items-center gap-4">
                  <Image
                    src={loanAssetImg}
                    alt={group.loanAsset.symbol}
                    width={24}
                    height={24}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="font-zen">{group.loanAsset.symbol} Markets</span>
                  <span className="text-sm text-gray-500">
                    Total selected: {selectedMarketsCount} market
                    {selectedMarketsCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 bg-background/50 px-4 py-3">
                      {/* Active Markets */}
                      {group.activeMarkets.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-primary">Active Markets</h4>
                          {group.activeMarkets.map((market) => (
                            <MarketRow
                              key={market.uniqueKey}
                              market={market}
                              isSelected={isMarketSelected(market)}
                              onToggle={(selected) =>
                                selected ? onAddMarket(market) : onRemoveMarket(market)
                              }
                            />
                          ))}
                        </div>
                      )}

                      {/* Historical Markets */}
                      {group.historicalMarkets.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-secondary">Previously Used</h4>
                          {group.historicalMarkets.map((market) => (
                            <MarketRow
                              key={market.uniqueKey}
                              market={market}
                              isSelected={isMarketSelected(market)}
                              onToggle={(selected) =>
                                selected ? onAddMarket(market) : onRemoveMarket(market)
                              }
                            />
                          ))}
                        </div>
                      )}

                      {/* Other Markets */}
                      {group.otherMarkets.length > 0 && !showAllMarkets && (
                        <Button
                          variant="light"
                          size="sm"
                          onClick={() => setShowAllMarkets(true)}
                          className="w-full"
                        >
                          Show More Markets
                        </Button>
                      )}

                      {showAllMarkets && group.otherMarkets.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-500">Other Available</h4>
                          {group.otherMarkets.map((market) => (
                            <MarketRow
                              key={market.uniqueKey}
                              market={market}
                              isSelected={isMarketSelected(market)}
                              onToggle={(selected) =>
                                selected ? onAddMarket(market) : onRemoveMarket(market)
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-between">
        <Button variant="light" onPress={onBack}>
          Back
        </Button>
        <Button
          variant="solid"
          color="primary"
          onPress={handleExecute}
          isDisabled={selectedCaps.length === 0}
        >
          Execute
        </Button>
      </div>
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Checkbox,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
} from '@nextui-org/react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { BsQuestionCircle } from 'react-icons/bs';
import { formatUnits, maxUint256 } from 'viem';
import { AgentSetupProcessModal } from '@/components/AgentSetupProcessModal';
import { Button } from '@/components/common/Button';
import { MarketInfoBlockCompact } from '@/components/common/MarketInfoBlock';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { MarketCap, useAuthorizeAgent } from '@/hooks/useAuthorizeAgent';
import { findAgent, KnownAgents } from '@/utils/monarch-agent';
import {
  getNetworkName,
  getNetworkImg,
  SupportedNetworks,
  isAgentAvailable,
} from '@/utils/networks';
import { Market, MarketPosition, UserRebalancerInfo } from '@/utils/types';

type MarketGroup = {
  network: SupportedNetworks;
  loanAsset: {
    address: string;
    symbol: string;
  };

  // setup already: this includes markets that have been authorized for agent
  authorizedMarkets: Market[];
  // have not setup yet, but currently acitve so should be consider priority
  activeMarkets: Market[];
  historicalMarkets: Market[];
  otherMarkets: Market[];
};

type SetupAgentProps = {
  positions: MarketPosition[];
  allMarkets: Market[];
  userRebalancerInfo?: UserRebalancerInfo;
  pendingCaps: MarketCap[];
  addToPendingCaps: (market: Market, cap: bigint) => void;
  removeFromPendingCaps: (market: Market) => void;
  onBack: () => void;
  onNext: () => void;
};

// Helper component for market rows
function MarketRow({
  market,
  isSelected,
  onToggle,
  isDisabled,
}: {
  market: Market;
  isSelected: boolean;
  onToggle: (selected: boolean) => void;
  isDisabled: boolean;
}) {
  return (
    <div
      className={`group flex items-center justify-between rounded-lg px-2 py-1 transition-opacity ${
        isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-content2'
      }`}
    >
      <div className="flex flex-1 items-center gap-3">
        <Checkbox
          isSelected={isSelected}
          onValueChange={(selected) => !isDisabled && onToggle(selected)}
          size="sm"
          color="primary"
          className="mr-0"
          isDisabled={isDisabled}
        />
        <MarketInfoBlockCompact market={market} className="flex-1" />
      </div>
    </div>
  );
}

export function SetupAgent({
  positions,
  allMarkets,
  userRebalancerInfo,
  pendingCaps,
  addToPendingCaps,
  removeFromPendingCaps,
  onBack,
  onNext,
}: SetupAgentProps) {
  const [hasPreselected, setHasPreselected] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);

  const [targetNetwork, setTargetNetwork] = useState<SupportedNetworks>(SupportedNetworks.Base);

  // --- Network Logic Start ---
  const availableNetworks = useMemo(() => {
    const networkSet = new Set<SupportedNetworks>();
    positions.forEach((p) => {
      if (isAgentAvailable(p.market.morphoBlue.chain.id)) {
        networkSet.add(p.market.morphoBlue.chain.id);
      }
    });
    return Array.from(networkSet).sort();
  }, [positions, allMarkets]);

  const isInPending = (market: Market) =>
    pendingCaps.some((cap) => cap.market.uniqueKey === market.uniqueKey && cap.amount > 0);

  // determine if a pre-authorized market is in pending remove
  const isInPendingRemove = (market: Market) =>
    pendingCaps.some(
      (cap) => cap.market.uniqueKey === market.uniqueKey && cap.amount === BigInt(0),
    );

  // Group markets by loan asset and categorize them
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, MarketGroup> = {};

    // First, identify active loan assets from positions
    const activeLoanAssets = new Set<string>();

    positions.forEach((position) => {
      if (BigInt(position.state.supplyShares) > 0) {
        activeLoanAssets.add(position.market.loanAsset.address.toLowerCase());
      }
    });

    // Only process markets for active loan assets
    allMarkets.forEach((market) => {
      const loanAssetKey = market.loanAsset.address.toLowerCase();
      if (!activeLoanAssets.has(loanAssetKey)) return;

      if (!groups[loanAssetKey]) {
        groups[loanAssetKey] = {
          network: market.morphoBlue.chain.id,
          loanAsset: market.loanAsset,
          authorizedMarkets: [],
          activeMarkets: [],
          historicalMarkets: [],
          otherMarkets: [],
        };
      }

      const authorized = userRebalancerInfo?.marketCaps.find(
        (c) => c.marketId.toLowerCase() === market.uniqueKey.toLowerCase(),
      )?.cap;
      if (authorized) {
        groups[loanAssetKey].authorizedMarkets.push(market);
        return;
      }

      // only process un-authorized markets
      const position = positions.find((p) => p.market.uniqueKey === market.uniqueKey);
      if (position) {
        const supply = parseFloat(
          formatUnits(BigInt(position.state.supplyAssets), position.market.loanAsset.decimals),
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

    // Sort groups by network ID first, then potentially by loan asset symbol
    return Object.values(groups).sort((a, b) => {
      if (a.network !== b.network) {
        return a.network - b.network;
      }
      return a.loanAsset.symbol.localeCompare(b.loanAsset.symbol);
    });
  }, [allMarkets, positions, userRebalancerInfo]);

  // Pre-select active markets only once when component mounts and target network is set
  useEffect(() => {
    let mounted = true;
    if (!hasPreselected && groupedMarkets.length > 0 && targetNetwork) {
      groupedMarkets.forEach((group) => {
        if (group.network === targetNetwork) {
          group.activeMarkets.forEach((market) => {
            if (!isInPending(market)) {
              addToPendingCaps(market, maxUint256);
            }
          });
        }
      });
      if (mounted) {
        setHasPreselected(true);
      }
    }

    return () => {
      mounted = false;
    };
  }, [hasPreselected, groupedMarkets, isInPending, addToPendingCaps, targetNetwork]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const hasSetupAgent =
    userRebalancerInfo?.rebalancer.toLowerCase() === KnownAgents.MAX_APY.toLowerCase();

  // todo: search user agent after
  const agent = findAgent(KnownAgents.MAX_APY ?? '');

  const { executeBatchSetupAgent, currentStep } = useAuthorizeAgent(
    KnownAgents.MAX_APY,
    pendingCaps,
    targetNetwork,
    onNext,
  );

  const handleExecute = useCallback(() => {
    setShowProcessModal(true);
    void executeBatchSetupAgent(() => setShowProcessModal(false));
  }, [executeBatchSetupAgent]);

  return (
    <div className="flex flex-col gap-6">
      {!hasSetupAgent && agent && (
        <div className="rounded border border-divider bg-content1 p-4">
          <h3 className="font-monospace text-sm">{agent.name}</h3>
          <p className="mt-2 font-zen text-sm text-secondary">{agent.strategyDescription}</p>
        </div>
      )}
      <div className="flex items-center justify-between font-zen text-sm">
        <span>The agent can only reallocate funds among approved markets.</span>
        {availableNetworks.length > 1 && targetNetwork && (
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="gap-2">
                <Image
                  src={getNetworkImg(targetNetwork) ?? ''}
                  alt={getNetworkName(targetNetwork) ?? 'Unknown Network'}
                  width={16}
                  height={16}
                />
                {getNetworkName(targetNetwork) ?? 'Select Network'}
                <ChevronDownIcon />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Select Network"
              selectionMode="single"
              selectedKeys={new Set([targetNetwork.toString()])}
              onSelectionChange={(keys) => {
                const selectedKey = Array.from(keys)[0];
                setTargetNetwork(Number(selectedKey) as SupportedNetworks);
                setHasPreselected(false);
              }}
            >
              {availableNetworks.map((networkId) => (
                <DropdownItem key={networkId.toString()} value={networkId.toString()}>
                  <div className="flex items-center gap-2">
                    <Image
                      src={getNetworkImg(networkId) ?? ''}
                      alt={getNetworkName(networkId) ?? 'Unknown Network'}
                      width={16}
                      height={16}
                    />
                    {getNetworkName(networkId) ?? `Network ${networkId}`}
                  </div>
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        )}
      </div>

      <div
        className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-100 
        dark:scrollbar-thumb-gray-500 dark:scrollbar-track-gray-800 
        hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-400 
        max-h-[400px] space-y-4 overflow-y-auto pr-2"
      >
        {groupedMarkets.map((group) => {
          const groupKey = `${group.loanAsset.address}-${group.network}`;
          const isExpanded = expandedGroups.includes(groupKey);
          const isGroupDisabled = group.network !== targetNetwork;

          const numMarketsToAdd = [
            ...group.activeMarkets,
            ...group.historicalMarkets,
            ...group.otherMarkets,
          ].filter(isInPending).length;

          const numMarketsToRemove = group.authorizedMarkets.filter(isInPendingRemove).length;

          return (
            <div
              key={groupKey}
              className="overflow-hidden rounded border border-divider bg-content1"
            >
              {showProcessModal && (
                <AgentSetupProcessModal
                  currentStep={currentStep}
                  onClose={() => setShowProcessModal(false)}
                />
              )}

              <button
                type="button"
                onClick={() => !isGroupDisabled && toggleGroup(groupKey)}
                className={`flex w-full items-center justify-between px-4 py-3 transition-colors ${
                  isGroupDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-content2'
                }`}
                disabled={isGroupDisabled}
              >
                <div className="flex items-center gap-4">
                  <TokenIcon
                    address={group.loanAsset.address}
                    chainId={group.network}
                    symbol={group.loanAsset.symbol}
                    width={24}
                    height={24}
                  />
                  <span className="font-zen">{group.loanAsset.symbol} Markets</span>
                  <span className="text-sm text-gray-500">
                    Authorized: {group.authorizedMarkets.length}{' '}
                    {numMarketsToAdd > 0 && (
                      <span className="text-sm text-green-700 dark:text-green-300">
                        (+ {numMarketsToAdd})
                      </span>
                    )}
                    {numMarketsToRemove > 0 && (
                      <span className="text-sm text-red-700 dark:text-red-300">
                        (- {numMarketsToRemove})
                      </span>
                    )}{' '}
                    market
                    {group.authorizedMarkets.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Tooltip
                  isDisabled={!isGroupDisabled}
                  className="rounded-sm"
                  content={
                    <TooltipContent
                      title="Network Mismatch"
                      detail="You're currently setting up the agent on a different network. Please switch the target network above."
                      icon={<BsQuestionCircle size={16} />}
                    />
                  }
                >
                  <div className="flex items-center gap-2">
                    <Image
                      src={getNetworkImg(group.network) ?? ''}
                      alt={getNetworkName(group.network) ?? 'Network'}
                      width={16}
                      height={16}
                    />
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </div>
                </Tooltip>
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
                      {/* Authorized markets Markets */}
                      {group.authorizedMarkets.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-secondary">Authorized</h4>
                          {group.authorizedMarkets.map((market) => (
                            <MarketRow
                              key={market.uniqueKey}
                              market={market}
                              isSelected={!isInPendingRemove(market)}
                              onToggle={(selected) =>
                                selected
                                  ? removeFromPendingCaps(market)
                                  : addToPendingCaps(market, BigInt(0))
                              }
                              isDisabled={isGroupDisabled}
                            />
                          ))}
                        </div>
                      )}

                      {/* Active Markets */}
                      {group.activeMarkets.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-primary">Active Markets</h4>
                          {group.activeMarkets.map((market) => (
                            <MarketRow
                              key={market.uniqueKey}
                              market={market}
                              isSelected={isInPending(market)}
                              onToggle={(selected) =>
                                selected
                                  ? addToPendingCaps(market, maxUint256)
                                  : removeFromPendingCaps(market)
                              }
                              isDisabled={isGroupDisabled}
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
                              isSelected={isInPending(market)}
                              onToggle={(selected) =>
                                selected
                                  ? addToPendingCaps(market, maxUint256)
                                  : removeFromPendingCaps(market)
                              }
                              isDisabled={isGroupDisabled}
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
                          isDisabled={isGroupDisabled}
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
                              isSelected={isInPending(market)}
                              onToggle={(selected) =>
                                selected
                                  ? addToPendingCaps(market, maxUint256)
                                  : removeFromPendingCaps(market)
                              }
                              isDisabled={isGroupDisabled}
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
          isDisabled={pendingCaps.length === 0 || !targetNetwork}
        >
          Execute
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { type Address, zeroAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import type { PerformanceFeeConfig } from '@/hooks/useVaultV2';
import type { SupportedNetworks } from '@/utils/networks';
import { v2AgentsBase, findAgent } from '@/utils/monarch-agent';
import { getAgentLabel, getAgentIcon } from './agent-display';
import { AddressIdentity } from '@/components/shared/address-identity';

type EditAllocatorsProps = {
  allocators: Address[];
  chainId: SupportedNetworks;
  isOwner: boolean;
  isUpdating: boolean;
  onAddAllocator: (allocator: Address, performanceFeeConfig?: PerformanceFeeConfig) => Promise<boolean>;
  onRemoveAllocator: (allocator: Address, performanceFeeConfig?: PerformanceFeeConfig) => Promise<boolean>;
  onSwapAllocator: (oldAllocator: Address, newAllocator: Address, performanceFeeConfig?: PerformanceFeeConfig) => Promise<boolean>;
  onBack: () => void;
};

export function EditAllocators({
  allocators,
  chainId,
  isOwner,
  isUpdating,
  onAddAllocator,
  onRemoveAllocator,
  onSwapAllocator,
  onBack,
}: EditAllocatorsProps) {
  const [targetAllocator, setTargetAllocator] = useState<Address | null>(null);

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });

  // Find if there's already a Monarch agent assigned
  const currentMonarchAgent = useMemo(() => {
    const monarchAddresses = new Set(v2AgentsBase.map((a) => a.address.toLowerCase()));
    return allocators.find((a) => monarchAddresses.has(a.toLowerCase())) as Address | undefined;
  }, [allocators]);

  const handleRemove = useCallback(
    async (allocator: Address) => {
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }
      setTargetAllocator(allocator);
      try {
        // Check if removing a Monarch agent
        const isMonarchAgent = findAgent(allocator) !== undefined;

        // If removing a Monarch agent, check if there are other Monarch agents remaining
        const otherMonarchAgents = allocators.filter(
          (a) => a.toLowerCase() !== allocator.toLowerCase() && findAgent(a) !== undefined
        );

        // Reset performance fee to 0 if removing the last Monarch agent
        const shouldResetFee = isMonarchAgent && otherMonarchAgents.length === 0;

        // When resetting, set fee to 0 and recipient to zero address
        const resetConfig: PerformanceFeeConfig | undefined = shouldResetFee
          ? { fee: 0n, recipient: zeroAddress }
          : undefined;

        await onRemoveAllocator(allocator, resetConfig);
      } finally {
        setTargetAllocator(null);
      }
    },
    [needSwitchChain, switchToNetwork, allocators, onRemoveAllocator],
  );

  const handleAddOrSwap = useCallback(
    async (newAllocator: Address) => {
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }
      setTargetAllocator(newAllocator);
      try {
        // Get the agent's performance fee config if defined
        const agent = findAgent(newAllocator);
        const performanceFeeConfig: PerformanceFeeConfig | undefined =
          agent?.performanceFee !== undefined && agent?.performanceFeeRecipient
            ? { fee: agent.performanceFee, recipient: agent.performanceFeeRecipient }
            : undefined;

        if (currentMonarchAgent) {
          // Swap: remove old Monarch agent and add new one in single tx
          await onSwapAllocator(currentMonarchAgent, newAllocator, performanceFeeConfig);
        } else {
          // No existing Monarch agent, just add
          await onAddAllocator(newAllocator, performanceFeeConfig);
        }
      } finally {
        setTargetAllocator(null);
      }
    },
    [needSwitchChain, switchToNetwork, currentMonarchAgent, onSwapAllocator, onAddAllocator],
  );

  const availableAllocators = useMemo(() => {
    const currentAddresses = new Set(allocators.map((a) => a.toLowerCase()));
    return v2AgentsBase.filter((agent) => !currentAddresses.has(agent.address.toLowerCase()));
  }, [allocators]);

  const isTargetLoading = (address: string) => isUpdating && targetAllocator === address;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase text-secondary">Edit Allocators</p>
          <p className="text-xs text-secondary">Manage automation agents executing the configured strategy.</p>
        </div>
      </div>

      <div className="space-y-4">
        {allocators.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-secondary">Current Allocators</p>
            {allocators.map((address) => {
              const agent = findAgent(address);
              const feePercent = agent?.performanceFee !== undefined
                ? Number(agent.performanceFee) / 1e16
                : null;

              return (
                <div
                  key={address}
                  className="flex items-center justify-between rounded border border-line bg-surface p-3"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AddressIdentity
                        address={address}
                        chainId={chainId}
                        label={getAgentLabel(address)}
                        icon={getAgentIcon(address)}
                      />
                      {feePercent !== null && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-secondary dark:bg-gray-800">
                          {feePercent > 0 ? `${feePercent}% fee on generated yield` : 'No fee'}
                        </span>
                      )}
                    </div>
                    {agent?.strategyDescription && (
                      <p className="text-xs text-secondary">{agent.strategyDescription}</p>
                    )}
                  </div>
                  <Button
                  variant="default"
                  size="sm"
                  onClick={() => void handleRemove(address)}
                  disabled={!isOwner || isUpdating}
                >
                  {isTargetLoading(address) ? (
                    <span className="flex items-center gap-2">
                      <Spinner size={12} /> Removing...
                    </span>
                  ) : needSwitchChain ? (
                    'Switch Network'
                  ) : (
                    'Remove'
                  )}
                </Button>
              </div>
              );
            })}
          </div>
        )}

        {availableAllocators.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-secondary">{allocators.length > 0 ? 'Available to Add' : 'Select Allocator'}</p>
            {availableAllocators.map((agent) => {
              const feePercent = agent.performanceFee !== undefined
                ? Number(agent.performanceFee) / 1e16  // Convert WAD to percentage
                : null;

              return (
                <div
                  key={agent.address}
                  className="flex items-center justify-between rounded border border-line bg-surface p-3"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AddressIdentity
                        address={agent.address}
                        chainId={chainId}
                        label={agent.name}
                        icon={getAgentIcon(agent.address)}
                      />
                      {feePercent !== null && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-secondary dark:bg-gray-800">
                          {feePercent}% fee on generated yield
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary">{agent.strategyDescription}</p>
                  </div>
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => void handleAddOrSwap(agent.address as Address)}
                  disabled={!isOwner || isUpdating}
                >
                  {isTargetLoading(agent.address) ? (
                    <span className="flex items-center gap-2">
                      <Spinner size={12} /> {currentMonarchAgent ? 'Swapping...' : 'Adding...'}
                    </span>
                  ) : needSwitchChain ? (
                    'Switch Network'
                  ) : currentMonarchAgent ? (
                    'Swap'
                  ) : (
                    'Add'
                  )}
                </Button>
              </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end border-t border-divider/30 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

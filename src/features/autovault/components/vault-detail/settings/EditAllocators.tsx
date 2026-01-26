'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import type { SupportedNetworks } from '@/utils/networks';
import { v2AgentsBase } from '@/utils/monarch-agent';
import { getAgentLabel, getAgentIcon } from './agent-display';
import { RoleAddressItem } from './RoleAddressItem';

type EditAllocatorsProps = {
  allocators: Address[];
  chainId: SupportedNetworks;
  isOwner: boolean;
  isUpdating: boolean;
  onAddAllocator: (allocator: Address) => Promise<boolean>;
  onRemoveAllocator: (allocator: Address) => Promise<boolean>;
  onBack: () => void;
};

export function EditAllocators({
  allocators,
  chainId,
  isOwner,
  isUpdating,
  onAddAllocator,
  onRemoveAllocator,
  onBack,
}: EditAllocatorsProps) {
  const [targetAllocator, setTargetAllocator] = useState<Address | null>(null);

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });

  const handleAllocatorAction = useCallback(
    async (allocator: Address, action: (a: Address) => Promise<boolean>) => {
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }
      setTargetAllocator(allocator);
      try {
        await action(allocator);
      } finally {
        setTargetAllocator(null);
      }
    },
    [needSwitchChain, switchToNetwork],
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
            {allocators.map((address) => (
              <div
                key={address}
                className="flex items-center justify-between rounded border border-line bg-surface p-3"
              >
                <RoleAddressItem
                  address={address}
                  chainId={chainId}
                  label={getAgentLabel(address)}
                  icon={getAgentIcon(address)}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void handleAllocatorAction(address, onRemoveAllocator)}
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
            ))}
          </div>
        )}

        {availableAllocators.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-secondary">{allocators.length > 0 ? 'Available to Add' : 'Select Allocator'}</p>
            {availableAllocators.map((agent) => (
              <div
                key={agent.address}
                className="flex items-center justify-between rounded border border-line bg-surface p-3"
              >
                <div className="flex flex-col gap-2">
                  <RoleAddressItem
                    address={agent.address}
                    chainId={chainId}
                    label={agent.name}
                    icon={getAgentIcon(agent.address)}
                  />
                  <p className="text-xs text-secondary">{agent.strategyDescription}</p>
                </div>
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => void handleAllocatorAction(agent.address as Address, onAddAllocator)}
                  disabled={!isOwner || isUpdating}
                >
                  {isTargetLoading(agent.address) ? (
                    <span className="flex items-center gap-2">
                      <Spinner size={12} /> Adding...
                    </span>
                  ) : needSwitchChain ? (
                    'Switch Network'
                  ) : (
                    'Add'
                  )}
                </Button>
              </div>
            ))}
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

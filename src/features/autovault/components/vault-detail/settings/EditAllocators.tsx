'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import type { SupportedNetworks } from '@/utils/networks';
import { v2AgentsBase, findAgent } from '@/utils/monarch-agent';
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

  const handleAddAllocator = useCallback(
    async (allocator: Address) => {
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }
      setTargetAllocator(allocator);
      try {
        await onAddAllocator(allocator);
      } finally {
        setTargetAllocator(null);
      }
    },
    [onAddAllocator, needSwitchChain, switchToNetwork],
  );

  const handleRemoveAllocator = useCallback(
    async (allocator: Address) => {
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }
      setTargetAllocator(allocator);
      try {
        await onRemoveAllocator(allocator);
      } finally {
        setTargetAllocator(null);
      }
    },
    [onRemoveAllocator, needSwitchChain, switchToNetwork],
  );

  const currentAllocatorAddresses = allocators.map((a) => a.toLowerCase());
  const availableAllocators = v2AgentsBase.filter((agent) => !currentAllocatorAddresses.includes(agent.address.toLowerCase()));

  const getAgentLabel = (address: string) => {
    const agent = findAgent(address);
    return agent?.name;
  };

  const getAgentIcon = (address: string) => {
    const agent = findAgent(address);
    if (!agent?.image) return undefined;
    return (
      <Image
        src={agent.image}
        alt={agent.name}
        width={14}
        height={14}
        className="rounded-full"
      />
    );
  };

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
                  onClick={() => void handleRemoveAllocator(address)}
                  disabled={!isOwner || (isUpdating && targetAllocator === address)}
                >
                  {isUpdating && targetAllocator === address ? (
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
            <p className="text-xs font-medium text-secondary">
              {allocators.length > 0 ? 'Available to Add' : 'Select Allocator'}
            </p>
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
                    icon={
                      <Image
                        src={agent.image}
                        alt={agent.name}
                        width={14}
                        height={14}
                        className="rounded-full"
                      />
                    }
                  />
                  <p className="text-xs text-secondary">{agent.strategyDescription}</p>
                </div>
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => void handleAddAllocator(agent.address as Address)}
                  disabled={!isOwner || (isUpdating && targetAllocator === (agent.address as Address))}
                >
                  {isUpdating && targetAllocator === (agent.address as Address) ? (
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

        <div className="flex justify-end pt-4 border-t border-divider/30">
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

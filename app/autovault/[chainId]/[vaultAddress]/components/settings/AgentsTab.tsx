import { useCallback, useState } from 'react';
import type { Address } from 'viem';
import { AccountIdentity } from '@/components/common/AccountIdentity';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { v2AgentsBase } from '@/utils/monarch-agent';
import { AgentListItem } from './AgentListItem';
import type { AgentsTabProps } from './types';

export function AgentsTab({
  isOwner,
  owner,
  curator,
  allocators,
  // sentinels = [],
  onSetAllocator,
  isUpdatingAllocator,
  chainId,
}: AgentsTabProps) {
  const [allocatorToAdd, setAllocatorToAdd] = useState<Address | null>(null);
  const [allocatorToRemove, setAllocatorToRemove] = useState<Address | null>(null);
  const [isEditingAllocators, setIsEditingAllocators] = useState(false);

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });

  const handleAddAllocator = useCallback(
    async (allocator: Address) => {
      // Switch network if needed
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }

      setAllocatorToAdd(allocator);
      try {
        await onSetAllocator(allocator, true);
      } finally {
        setAllocatorToAdd(null);
      }
    },
    [onSetAllocator, needSwitchChain, switchToNetwork],
  );

  const handleRemoveAllocator = useCallback(
    async (allocator: Address) => {
      // Switch network if needed
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }

      setAllocatorToRemove(allocator);
      const success = await onSetAllocator(allocator, false);
      if (success) {
        setAllocatorToRemove(null);
      }
    },
    [onSetAllocator, needSwitchChain, switchToNetwork],
  );

  const renderSingleRole = (label: string, description: string, addressValue?: string) => {
    const normalized = addressValue ? (addressValue as Address) : undefined;

    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-xs uppercase text-secondary">{label}</p>
          <p className="text-xs text-secondary">{description}</p>
        </div>
        {normalized ? (
          <AccountIdentity
            address={normalized}
            variant="compact"
            linkTo="explorer"
            copyable
          />
        ) : (
          <span className="text-xs text-secondary">Not assigned</span>
        )}
      </div>
    );
  };

  const currentAllocatorAddresses = allocators.map((a) => a.toLowerCase());
  const availableAllocators = v2AgentsBase.filter((agent) => !currentAllocatorAddresses.includes(agent.address.toLowerCase()));

  return (
    <div className="space-y-6">
      {renderSingleRole('Owner', 'Primary controller of vault permissions.', owner)}
      {renderSingleRole('Curator', 'Defines risk guardrails for automation.', curator)}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Allocators</p>
            <p className="text-xs text-secondary">Automation agents executing the configured strategy.</p>
          </div>
          {!isEditingAllocators && (
            <Button
              variant="interactive"
              size="sm"
              onPress={() => setIsEditingAllocators(true)}
              isDisabled={!isOwner}
            >
              {allocators.length === 0 ? 'Add allocators' : 'Edit'}
            </Button>
          )}
        </div>

        {isEditingAllocators ? (
          // Edit mode
          <div className="space-y-4">
            {allocators.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-secondary">Current Allocators</p>
                {allocators.map((address) => (
                  <div
                    key={address}
                    className="flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                  >
                    <AgentListItem address={address as Address} />
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => void handleRemoveAllocator(address as Address)}
                      isDisabled={isUpdatingAllocator && allocatorToRemove === (address as Address)}
                    >
                      {isUpdatingAllocator && allocatorToRemove === (address as Address) ? (
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
                    className="flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                  >
                    <div className="flex flex-col gap-2">
                      <AgentListItem address={agent.address as Address} />
                      <p className="ml-8 text-xs text-secondary">{agent.strategyDescription}</p>
                    </div>
                    <Button
                      variant="interactive"
                      size="sm"
                      onPress={() => void handleAddAllocator(agent.address as Address)}
                      isDisabled={isUpdatingAllocator && allocatorToAdd === (agent.address as Address)}
                    >
                      {isUpdatingAllocator && allocatorToAdd === (agent.address as Address) ? (
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

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setIsEditingAllocators(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : // Read-only view
        allocators.length === 0 ? (
          <p className="text-sm text-secondary">No allocators assigned</p>
        ) : (
          <div className="space-y-2">
            {allocators.map((address) => (
              <div
                key={address}
                className="rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
              >
                <AgentListItem address={address as Address} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* dont show sentinels for now */}
      {/* <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Sentinels</p>
            <p className="text-xs text-secondary">
              Sentinels able to pause automation when safeguards trigger.
            </p>
          </div>
        </div>
        {sentinels.length === 0 ? (
          <p className="text-sm text-secondary">No sentinels configured</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sentinels.map((address) => (
              <AccountIdentity
                key={address}
                address={address as Address}
                variant="compact"
                linkTo="explorer"
                copyable
              />
            ))}
          </div>
        )}
      </div> */}
    </div>
  );
}

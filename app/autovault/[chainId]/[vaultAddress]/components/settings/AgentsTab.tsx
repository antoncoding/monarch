import { useCallback, useState } from 'react';
import { Address } from 'viem';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { v2AgentsBase } from '@/utils/monarch-agent';
import { AgentsTabProps } from './types';

export function AgentsTab({
  isOwner,
  owner,
  curator,
  allocators,
  sentinels = [],
  onSetAllocator,
  isUpdatingAllocator,
}: AgentsTabProps) {
  const [allocatorToAdd, setAllocatorToAdd] = useState<Address | null>(null);
  const [allocatorToRemove, setAllocatorToRemove] = useState<Address | null>(null);
  const [isEditingAllocators, setIsEditingAllocators] = useState(false);

  const handleAddAllocator = useCallback(
    async (allocator: Address) => {
      setAllocatorToAdd(allocator);
      const success = await onSetAllocator(allocator, true);
      if (success) {
        setAllocatorToAdd(null);
      }
    },
    [onSetAllocator],
  );

  const handleRemoveAllocator = useCallback(
    async (allocator: Address) => {
      setAllocatorToRemove(allocator);
      const success = await onSetAllocator(allocator, false);
      if (success) {
        setAllocatorToRemove(null);
      }
    },
    [onSetAllocator],
  );

  const renderSingleRole = (
    label: string,
    description: string,
    addressValue?: string,
  ) => {
    const normalized = addressValue ? (addressValue as Address) : undefined;

    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-xs uppercase text-secondary">{label}</p>
          <p className="text-xs text-secondary">{description}</p>
        </div>
        {normalized ? (
          <AddressDisplay
            address={normalized}
            size="sm"
            showExplorerLink
            copyable
          />
        ) : (
          <span className="text-xs text-secondary">Not assigned</span>
        )}
      </div>
    );
  };

  const renderRoleList = (
    label: string,
    description: string,
    addresses: string[],
    emptyLabel: string,
  ) => {
    if (!addresses.length) {
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">{label}</p>
            <p className="text-xs text-secondary">{description}</p>
          </div>
          <span className="text-xs text-secondary">{emptyLabel}</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-xs uppercase text-secondary">{label}</p>
          <p className="text-xs text-secondary">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {addresses.map((entry) => (
            <AddressDisplay
              key={entry}
              address={entry as Address}
              size="sm"
              showExplorerLink
              copyable
            />
          ))}
        </div>
      </div>
    );
  };

  const currentAllocatorAddresses = allocators.map((a) => a.toLowerCase());
  const availableAllocators = v2AgentsBase.filter(
    (agent) => !currentAllocatorAddresses.includes(agent.address.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {renderSingleRole('Owner', 'Primary controller of vault permissions.', owner)}
      {renderSingleRole('Curator', 'Defines risk guardrails for automation.', curator)}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Allocators</p>
            <p className="text-xs text-secondary">
              Automation agents executing the configured strategy.
            </p>
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

        {!isEditingAllocators ? (
          // Read-only view
          allocators.length === 0 ? (
            <p className="text-sm text-secondary">No allocators assigned</p>
          ) : (
            <div className="space-y-2">
              {allocators.map((address) => {
                const agent = v2AgentsBase.find((a) => a.address.toLowerCase() === address.toLowerCase());
                return (
                  <div
                    key={address}
                    className="flex items-center gap-3 rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                  >
                    {agent ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{agent.name}</span>
                        <AddressDisplay address={address as Address} size="sm" />
                      </div>
                    ) : (
                      <AddressDisplay address={address as Address} size="sm" />
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // Edit mode
          <div className="space-y-4">
            {allocators.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-secondary">Current Allocators</p>
                {allocators.map((address) => {
                  const agent = v2AgentsBase.find((a) => a.address.toLowerCase() === address.toLowerCase());
                  return (
                    <div
                      key={address}
                      className="flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                    >
                      <div className="flex flex-col gap-1">
                        {agent ? (
                          <>
                            <span className="text-sm font-medium">{agent.name}</span>
                            <AddressDisplay address={address as Address} size="sm" />
                          </>
                        ) : (
                          <AddressDisplay address={address as Address} size="sm" />
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => void handleRemoveAllocator(address as Address)}
                        isDisabled={
                          isUpdatingAllocator && allocatorToRemove === (address as Address)
                        }
                      >
                        {isUpdatingAllocator && allocatorToRemove === (address as Address) ? (
                          <span className="flex items-center gap-2">
                            <Spinner size={12} /> Removing...
                          </span>
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
                <p className="text-xs font-medium text-secondary">
                  {allocators.length > 0 ? 'Available to Add' : 'Select Allocator'}
                </p>
                {availableAllocators.map((agent) => (
                  <div
                    key={agent.address}
                    className="flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{agent.name}</span>
                      <AddressDisplay address={agent.address as Address} size="sm" />
                      <p className="text-xs text-secondary">{agent.strategyDescription}</p>
                    </div>
                    <Button
                      variant="interactive"
                      size="sm"
                      onPress={() => void handleAddAllocator(agent.address as Address)}
                      isDisabled={
                        isUpdatingAllocator && allocatorToAdd === (agent.address as Address)
                      }
                    >
                      {isUpdatingAllocator && allocatorToAdd === (agent.address as Address) ? (
                        <span className="flex items-center gap-2">
                          <Spinner size={12} /> Adding...
                        </span>
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
        )}
      </div>

      {renderRoleList(
        'Sentinels',
        'Sentinels able to pause automation when safeguards trigger.',
        sentinels,
        'No sentinels configured',
      )}
    </div>
  );
}

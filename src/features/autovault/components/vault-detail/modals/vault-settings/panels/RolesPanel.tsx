'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import type { SupportedNetworks } from '@/utils/networks';
import { v2AgentsBase, findAgent } from '@/utils/monarch-agent';
import { RoleAddressItem } from '../../../settings/RoleAddressItem';

type RolesPanelProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
};

export function RolesPanel({ vaultAddress, chainId }: RolesPanelProps) {
  const { address: connectedAddress } = useConnection();

  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner, setAllocator, isUpdatingAllocator } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
  });
  const { morphoMarketV1Adapter } = useMorphoMarketV1Adapters({ vaultAddress, chainId });

  const owner = vaultData?.owner;
  const curator = vaultData?.curator;
  const allocators = vaultData?.allocators ?? [];
  const adapters = vaultData?.adapters ?? [];

  const [allocatorToAdd, setAllocatorToAdd] = useState<Address | null>(null);
  const [allocatorToRemove, setAllocatorToRemove] = useState<Address | null>(null);
  const [isEditingAllocators, setIsEditingAllocators] = useState(false);

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });

  const handleAddAllocator = useCallback(
    async (allocator: Address) => {
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }
      setAllocatorToAdd(allocator);
      try {
        await setAllocator(allocator, true);
      } finally {
        setAllocatorToAdd(null);
      }
    },
    [setAllocator, needSwitchChain, switchToNetwork],
  );

  const handleRemoveAllocator = useCallback(
    async (allocator: Address) => {
      if (needSwitchChain) {
        switchToNetwork();
        return;
      }
      setAllocatorToRemove(allocator);
      const success = await setAllocator(allocator, false);
      if (success) {
        setAllocatorToRemove(null);
      }
    },
    [setAllocator, needSwitchChain, switchToNetwork],
  );

  const isMarketV1Adapter = (addr: string) =>
    morphoMarketV1Adapter !== zeroAddress && addr.toLowerCase() === morphoMarketV1Adapter.toLowerCase();

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

  const renderRoleSection = (
    label: string,
    description: string,
    addresses: string[],
    options?: {
      getLabelOverride?: (addr: string) => string | undefined;
      getIconOverride?: (addr: string) => React.ReactNode | undefined;
    },
  ) => (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-xs uppercase text-secondary">{label}</p>
        <p className="text-xs text-secondary">{description}</p>
      </div>
      {addresses.length === 0 ? (
        <span className="text-xs text-secondary">Not assigned</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {addresses.map((addr) => (
            <RoleAddressItem
              key={addr}
              address={addr}
              chainId={chainId}
              label={options?.getLabelOverride?.(addr)}
              icon={options?.getIconOverride?.(addr)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Owner */}
      {renderRoleSection('Owner', 'Primary controller of vault permissions.', owner ? [owner] : [])}

      {/* Curator */}
      {renderRoleSection('Curator', 'Defines risk guardrails for automation.', curator ? [curator] : [])}

      {/* Allocators */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Allocators</p>
            <p className="text-xs text-secondary">Automation agents executing the configured strategy.</p>
          </div>
          {!isEditingAllocators && (
            <Button
              variant="surface"
              size="sm"
              onClick={() => setIsEditingAllocators(true)}
              disabled={!isOwner}
            >
              {allocators.length === 0 ? 'Add' : 'Edit'}
            </Button>
          )}
        </div>

        {isEditingAllocators ? (
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
                      onClick={() => void handleRemoveAllocator(address as Address)}
                      disabled={isUpdatingAllocator && allocatorToRemove === (address as Address)}
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
                      disabled={isUpdatingAllocator && allocatorToAdd === (agent.address as Address)}
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
                onClick={() => setIsEditingAllocators(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : allocators.length === 0 ? (
          <span className="text-xs text-secondary">Not assigned</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allocators.map((address) => (
              <RoleAddressItem
                key={address}
                address={address}
                chainId={chainId}
                label={getAgentLabel(address)}
                icon={getAgentIcon(address)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Adapters */}
      {renderRoleSection(
        'Adapters',
        'Contracts enabling vault interactions with underlying protocols.',
        adapters,
        {
          getLabelOverride: (addr) => (isMarketV1Adapter(addr) ? 'MorphoBlue Adapter' : undefined),
        },
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { GearIcon } from '@radix-ui/react-icons';
import { BsQuestionCircle } from 'react-icons/bs';
import { GrStatusGood } from 'react-icons/gr';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { AgentIcon } from '@/components/shared/agent-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { findAgent } from '@/utils/monarch-agent';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultSettingsModalStore } from '@/stores/vault-settings-modal-store';
import { useVaultInitializationModalStore } from '@/stores/vault-initialization-modal-store';
import type { SupportedNetworks } from '@/utils/networks';

type VaultAllocatorCardProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  needsInitialization: boolean;
};

export function VaultAllocatorCard({ vaultAddress, chainId, needsInitialization }: VaultAllocatorCardProps) {
  const { address: connectedAddress } = useConnection();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData, isLoading: vaultDataLoading } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner } = useVaultV2({ vaultAddress, chainId, connectedAddress });

  // UI state from Zustand
  const { open: openSettings } = useVaultSettingsModalStore();
  const { open: openInitialization } = useVaultInitializationModalStore();

  const allocators = vaultData?.allocators ?? [];
  const isLoading = vaultDataLoading;

  const handleManageAgents = () => {
    if (needsInitialization) {
      openInitialization();
    } else {
      openSettings('agents');
    }
  };
  const cardStyle = 'bg-surface rounded shadow-sm';
  const maxDisplay = 5;
  const iconSize = 20;

  // Find agent objects for all allocators
  const agents = useMemo(
    () =>
      allocators
        .map((allocatorAddress) => findAgent(allocatorAddress))
        .filter((agent): agent is NonNullable<typeof agent> => agent !== undefined),
    [allocators],
  );

  const hasAllocators = agents.length > 0;
  const preview = agents.slice(0, maxDisplay);
  const remaining = agents.slice(maxDisplay);

  return (
    <Card className={cardStyle}>
      <CardHeader className="flex items-center justify-between pb-2">
        <span className="text-xs uppercase tracking-wide text-secondary">Allocators</span>
        {isOwner && !needsInitialization && (
          <GearIcon
            className="h-4 w-4 cursor-pointer text-secondary hover:text-primary"
            onClick={handleManageAgents}
          />
        )}
      </CardHeader>
      <CardBody className="flex items-center justify-center py-3">
        {isLoading ? (
          <div className="bg-hovered h-5 w-24 rounded animate-pulse" />
        ) : needsInitialization ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-xs text-secondary">Setup required</span>
            </div>
          </div>
        ) : hasAllocators ? (
          <div className="flex items-center justify-center">
            {preview.map((agent, index) => (
              <div
                key={agent.address}
                className={`relative ${index === 0 ? 'ml-0' : '-ml-2'}`}
                style={{ zIndex: preview.length - index }}
              >
                <AgentIcon
                  address={agent.address as Address}
                  width={iconSize}
                  height={iconSize}
                />
              </div>
            ))}
            {remaining.length > 0 && (
              <Tooltip
                content={
                  <TooltipContent
                    title={<span className="text-sm font-semibold">More allocators</span>}
                    detail={
                      <div className="flex flex-col gap-2">
                        {remaining.map((agent) => (
                          <div
                            key={agent.address}
                            className="flex items-center gap-2"
                          >
                            <AgentIcon
                              address={agent.address as Address}
                              width={16}
                              height={16}
                            />
                            <span className="text-sm">{agent.name}</span>
                          </div>
                        ))}
                      </div>
                    }
                  />
                }
              >
                <span
                  className="-ml-2 flex items-center justify-center rounded-full border border-background/40 bg-hovered text-[11px] text-secondary"
                  style={{
                    width: iconSize,
                    height: iconSize,
                    zIndex: 0,
                  }}
                >
                  +{remaining.length}
                </span>
              </Tooltip>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-secondary">No allocators configured</span>
            <Tooltip
              content={
                <TooltipContent
                  icon={<GrStatusGood className="h-4 w-4" />}
                  title="Allocators"
                  detail="Add an allocator agent to enable automated vault rebalancing and allocation management."
                />
              }
            >
              <BsQuestionCircle />
            </Tooltip>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

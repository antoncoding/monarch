'use client';

import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import type { SupportedNetworks } from '@/utils/networks';
import { getAgentLabel, getAgentIcon } from '../../../settings/agent-display';
import { RoleAddressItem } from '../../../settings/RoleAddressItem';
import type { VaultDetailView } from '@/stores/vault-settings-modal-store';

type RolesPanelProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onNavigateToDetail?: (view: Exclude<VaultDetailView, null>) => void;
};

export function RolesPanel({ vaultAddress, chainId, onNavigateToDetail }: RolesPanelProps) {
  const { address: connectedAddress } = useConnection();

  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
  });
  const { morphoMarketV1Adapter } = useMorphoMarketV1Adapters({ vaultAddress, chainId });

  const owner = vaultData?.owner;
  const curator = vaultData?.curator;
  const allocators = vaultData?.allocators ?? [];
  const adapters = vaultData?.adapters ?? [];

  const isMarketV1Adapter = (addr: string) =>
    morphoMarketV1Adapter !== zeroAddress && addr.toLowerCase() === morphoMarketV1Adapter.toLowerCase();

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
          {isOwner && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onNavigateToDetail?.('edit-allocators')}
            >
              {allocators.length === 0 ? 'Add' : 'Edit'}
            </Button>
          )}
        </div>

        {allocators.length === 0 ? (
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
      {renderRoleSection('Adapters', 'Contracts enabling vault interactions with underlying protocols.', adapters, {
        getLabelOverride: (addr) => (isMarketV1Adapter(addr) ? 'MorphoBlue Adapter' : undefined),
      })}
    </div>
  );
}

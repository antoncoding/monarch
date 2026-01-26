'use client';

import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import type { SupportedNetworks } from '@/utils/networks';
import type { VaultDetailView } from '@/stores/vault-settings-modal-store';

type GeneralPanelProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onNavigateToDetail?: (view: Exclude<VaultDetailView, null>) => void;
};

export function GeneralPanel({ vaultAddress, chainId, onNavigateToDetail }: GeneralPanelProps) {
  const { address: connectedAddress } = useConnection();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner, name, symbol } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
  });

  const defaultName = vaultData?.displayName ?? '';
  const defaultSymbol = vaultData?.displaySymbol ?? '';
  const currentName = name || defaultName;
  const currentSymbol = symbol || defaultSymbol;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Vault Metadata</p>
            <p className="text-xs text-secondary">Basic information about the vault.</p>
          </div>
          {isOwner && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onNavigateToDetail?.('edit-metadata')}
            >
              Edit
            </Button>
          )}
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Vault Name</p>
            <p className="text-sm font-medium text-primary">{currentName}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-xs uppercase text-secondary">Vault Symbol</p>
            <p className="text-sm font-medium text-primary">{currentSymbol}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
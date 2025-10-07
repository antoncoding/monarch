'use client';

import { useMemo, useState } from 'react';
import { GearIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { AutovaultData, VaultAllocation, useVaultDetails } from '@/hooks/useAutovaultData';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { VaultAgentSummary } from './components/VaultAgentSummary';
import { VaultApyHistory } from './components/VaultApyHistory';
import { VaultAssetMovements, VaultAssetMovement } from './components/VaultAssetMovements';
import { VaultInitializationModal } from './components/VaultInitializationModal';
import { VaultMarketAllocations } from './components/VaultMarketAllocations';
import { VaultRolesModal } from './components/VaultRolesModal';
import { VaultRole } from './components/VaultRolesOverview';
import { VaultSettingsModal } from './components/VaultSettingsModal';
import { VaultSummaryMetrics, VaultMetric } from './components/VaultSummaryMetrics';

function formatUsd(value: number | bigint): string {
  const numeric = typeof value === 'bigint' ? Number(value) : value;
  if (!numeric || Number.isNaN(numeric)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: numeric >= 1 ? 2 : 4,
  }).format(numeric);
}

export default function VaultContent() {
  const { chainId: chainIdParam, vaultAddress } = useParams<{ chainId: string; vaultAddress: string }>();
  const vaultAddressValue = vaultAddress as Address;
  const { address } = useAccount();
  const supportedChainId = useMemo(() => {
    const parsed = Number(chainIdParam);
    if (Number.isFinite(parsed) && ALL_SUPPORTED_NETWORKS.includes(parsed as SupportedNetworks)) {
      return parsed as SupportedNetworks;
    }
    return SupportedNetworks.Base;
  }, [chainIdParam]);

  const networkConfig = useMemo(() => {
    try {
      return getNetworkConfig(supportedChainId);
    } catch (error) {
      return null;
    }
  }, [supportedChainId]);

  const {
    needsSetup,
    isLoading: adapterLoading,
    refetch: refetchAdapter,
    updateNameAndSymbol,
    isUpdatingMetadata,
    name: onChainName,
    symbol: onChainSymbol,
  } = useVaultV2({
    vaultAddress: vaultAddressValue,
    chainId: supportedChainId,
  });

  const [settingsTab, setSettingsTab] = useState<'general' | 'agents' | 'allocations'>('general');
  const [showSettings, setShowSettings] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showInitializationModal, setShowInitializationModal] = useState(false);

  const { vault, isLoading, isError } = useVaultDetails(vaultAddressValue);

  if (isLoading) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="container h-full px-[5%] py-12">
          <LoadingScreen
            message="Loading vault insights..."
            className="mx-auto max-w-md"
          />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="container h-full px-[5%] py-12">
          <div className="mx-auto max-w-md rounded bg-surface p-8 text-center shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Vault data unavailable</h2>
            <p className="mb-6 text-secondary">
              We could not load this autovault right now. Please retry in a few minutes.
            </p>
            <Link href="/autovault">
              <Button variant="cta">Back to Autovaults</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const placeholderVault: AutovaultData = {
    id: 'placeholder',
    address: vaultAddress as Address,
    name: 'Monarch Auto Vault',
    symbol: 'mAUTO',
    description: 'Track how your automation is performing and what still needs configuration.',
    totalValue: BigInt(2_100_000_000),
    currentApy: 7.4,
    agents: [
      {
        id: '0xallocator-bot',
        name: 'Allocator Bot',
        description: 'Automated allocator executing the base strategy.',
        status: 'active',
    performance: {
      totalValue: BigInt(1_500_000_000),
      apr: 6.9,
      totalReturns: BigInt(120_000_000),
    },
      },
    ],
    status: 'active',
    owner: (address ?? '0x0000000000000000000000000000000000000000') as Address,
    createdAt: now,
    lastActivity: now,
    rebalanceHistory: [],
    allocations: [],
  };

  const displayVault = vault ?? placeholderVault;
  const isPlaceholder = !vault;

  const isOwner = Boolean(
    displayVault?.owner &&
      address &&
      displayVault.owner.toLowerCase() === (address ?? '').toLowerCase(),
  );

  const metrics: VaultMetric[] = [
    {
      label: 'Total Assets',
      value: formatUsd(Number(displayVault.totalValue) / 1e6),
      helper: 'Assets currently automated across adapters',
    },
    {
      label: 'Current APY',
      value: displayVault.currentApy ? `${displayVault.currentApy.toFixed(2)}%` : '--',
      helper: 'Net of performance and management fees',
    },
    {
      label: '24h Earnings',
      value: isPlaceholder ? '$12,420' : '--',
      helper: 'Based on adapter reports (coming soon)',
    },
    {
      label: 'Last Activity',
      value: displayVault.lastActivity.toLocaleDateString(),
      helper: 'Most recent automation event',
    },
  ];

  const marketAllocations: VaultAllocation[] = displayVault.allocations ?? [];
  const vaultAssetSymbol = marketAllocations[0]?.assetSymbol ?? '—';
  const fallbackSymbol = vaultAssetSymbol !== '—' ? `m${vaultAssetSymbol}` : 'mAUTO';
  const fallbackName = `Monarch Auto ${vaultAssetSymbol !== '—' ? vaultAssetSymbol : 'Vault'}`;
  const effectiveName = (onChainName?.trim() || displayVault.name || fallbackName).trim();
  const effectiveSymbol = (onChainSymbol?.trim() || displayVault.symbol || fallbackSymbol).trim();

  const assetMovements: VaultAssetMovement[] = isPlaceholder
    ? []
    : displayVault.rebalanceHistory.map((rebalance) => ({
        timestamp: rebalance.timestamp.toLocaleString(),
        action: 'allocate',
        from: rebalance.fromMarket,
        to: rebalance.toMarket,
        amount: `${Number(rebalance.amount ?? 0n) / 1e6} tokens`,
      }));

  const allocatorAddresses = displayVault.agents.map((agent) => agent.id);

  const roles: VaultRole[] = [
    {
      key: 'owner',
      label: 'Owner',
      description: 'Appoints other roles and manages high-level governance.',
      addresses: displayVault.owner ? [displayVault.owner] : [],
      status: displayVault.owner ? 'configured' : 'pending',
      guidance: 'Assign a secure multisig (4-of-6 recommended) responsible for curators and sentinels.',
      capabilities: ['Transfer ownership', 'Appoint curator', 'Add/remove sentinels', 'Update vault metadata'],
    },
    {
      key: 'curator',
      label: 'Risk Curator',
      description: 'Defines adapters, caps, and fees via timelocked actions.',
      addresses: [],
      status: 'pending',
      guidance: 'Nominate a curator multisig so the strategy can evolve under controlled timelocks.',
      capabilities: ['Enable/disable adapters (timelocked)', 'Tune caps and rates', 'Manage allocators & compliance gates'],
    },
    {
      key: 'allocator',
      label: 'Allocator(s)',
      description: 'Executes the strategy within the guardrails the curator sets.',
      addresses: allocatorAddresses,
      status: allocatorAddresses.length > 0 ? 'configured' : 'pending',
      guidance: 'Authorize your automation agent or desk wallet so it can move liquidity between adapters.',
      capabilities: ['Allocate idle assets', 'Deallocate when liquidity is needed', 'Operate liquidity adapter for deposits'],
    },
    {
      key: 'sentinel',
      label: 'Sentinel',
      description: 'Emergency responder that can unwind or veto risky actions.',
      addresses: [],
      status: 'pending',
      guidance: 'Add a sentinel key (bot or DAO) that can revoke unsafe curator actions and unwind adapters fast.',
      capabilities: ['Instantly lower caps', 'Deallocate from adapters', 'Revoke timelocked actions before execution'],
    },
  ];

  return (
    <div className="flex w-full flex-col font-zen">
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-12">
        <div className="space-y-8">
          <div className="flex items-start gap-4 pt-6">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="font-zen text-2xl">{effectiveName}</h1>
                <span className="rounded bg-hovered px-2 py-1 text-xs text-secondary">{effectiveSymbol}</span>
              </div>
              <p className="text-sm text-secondary">{displayVault.description}</p>
              <div className="mt-2 text-xs text-secondary">Automation service overview • vault analytics</div>
            </div>
            {isOwner && (
              <Button
                variant="light"
                size="sm"
                onPress={() => {
                  setSettingsTab('general');
                  setShowSettings(true);
                }}
                className="flex items-center gap-2"
              >
                <GearIcon className="h-4 w-4" />
                Settings
              </Button>
            )}
          </div>

          <AddressDisplay address={vaultAddressValue} />

          {needsSetup && networkConfig?.vaultConfig?.marketV1AdapterFactory && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-primary">Adapter not configured</p>
                <p className="text-sm text-secondary">
                  Finish the initialization process to begin configuring strategies for this vault.
                </p>
              </div>
              <Button
                variant="cta"
                size="sm"
                className="mt-3 sm:mt-0"
                onPress={() => setShowInitializationModal(true)}
                isDisabled={adapterLoading}
              >
                Start setup
              </Button>
            </div>
          )}

          <VaultSummaryMetrics metrics={metrics} />

          <VaultAgentSummary
            isActive={displayVault.status === 'active'}
            activeAgents={allocatorAddresses.length}
            description={
              needsSetup
                ? 'Deploy the vault adapter before allocating capital.'
                : displayVault.status === 'active'
                  ? 'Allocators are authorized and rebalancing within curator caps.'
                  : 'Authorize an allocator to resume automated portfolio management.'
            }
            roleStatusText={
              needsSetup
                ? 'Adapter pending deployment'
                : roles.filter((role) => role.status !== 'configured').length > 0
                  ? `Pending roles: ${roles
                      .filter((role) => role.status !== 'configured')
                      .map((role) => role.label)
                      .join(', ')}`
                  : 'All critical roles are assigned to safe wallets.'
            }
            onManageAgents={() => {
              if (needsSetup && networkConfig?.vaultConfig?.marketV1AdapterFactory) {
                setShowInitializationModal(true);
                return;
              }
              setSettingsTab('agents');
              setShowSettings(true);
            }}
            onManageAllocations={() => {
              setSettingsTab('allocations');
              setShowSettings(true);
            }}
            onViewRoles={() => setShowRolesModal(true)}
          />

          <VaultMarketAllocations
            allocations={marketAllocations}
            vaultAssetSymbol={vaultAssetSymbol}
          />
          <VaultApyHistory timeframes={['7D', '30D', '90D']} />
          <VaultAssetMovements history={assetMovements} />

          <VaultSettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            initialTab={settingsTab}
            vault={displayVault}
            isOwner={isOwner}
            onUpdateMetadata={updateNameAndSymbol}
            updatingMetadata={isUpdatingMetadata}
            defaultName={fallbackName}
            defaultSymbol={fallbackSymbol}
            currentName={onChainName ?? ''}
            currentSymbol={onChainSymbol ?? ''}
          />
        </div>
      </div>

      <VaultRolesModal
        isOpen={showRolesModal}
        onClose={() => setShowRolesModal(false)}
        roles={roles}
      />
      {networkConfig?.vaultConfig?.marketV1AdapterFactory && (
        <VaultInitializationModal
          isOpen={showInitializationModal}
          onClose={() => setShowInitializationModal(false)}
          vaultAddress={vaultAddressValue}
          chainId={supportedChainId}
          onAdapterConfigured={() => void refetchAdapter()}
        />
      )}
    </div>
  );
}

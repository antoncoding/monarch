'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiZap } from 'react-icons/fi';
import { type Address, zeroAddress, decodeEventLog } from 'viem';
import { useParams } from 'next/navigation';
import { useConnection, usePublicClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AllocatorCard } from '@/components/shared/allocator-card';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Spinner } from '@/components/ui/spinner';
import { adapterFactoryAbi } from '@/abis/morpho-market-v1-adapter-factory-v2';
import { useDeployMorphoMarketV1Adapter } from '@/hooks/useDeployMorphoMarketV1Adapter';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { agents } from '@/utils/monarch-agent';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { useVaultKeysCache } from '@/stores/useVaultKeysCache';
import { useVaultInitializationModalStore } from '@/stores/vault-initialization-modal-store';

const ZERO_ADDRESS = zeroAddress;
const shortenAddress = (value: Address | string) => (value === ZERO_ADDRESS ? '0x0000…0000' : `${value.slice(0, 6)}…${value.slice(-4)}`);

const STEP_SEQUENCE = ['deploy', 'metadata', 'agents', 'finalize'] as const;
type StepId = (typeof STEP_SEQUENCE)[number];

function StepIndicator({ currentStep }: { currentStep: StepId }) {
  const currentIndex = STEP_SEQUENCE.findIndex((s) => s === currentStep);

  return (
    <div className="flex items-center justify-center gap-2">
      {STEP_SEQUENCE.map((step, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div
            key={step}
            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              isCurrent ? 'bg-primary' : isPast ? 'bg-primary/50' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        );
      })}
    </div>
  );
}

function DeployAdapterStep({
  isDeploying,
  adapterDetected,
  adapterAddress,
}: {
  isDeploying: boolean;
  adapterDetected: boolean;
  adapterAddress: Address;
}) {
  return (
    <div className="space-y-4 font-zen">
      <p className="text-sm text-secondary">Deploy a Morpho Market adapter so this vault can allocate assets into Morpho Blue markets.</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-secondary">
          {isDeploying && <Spinner size={12} />}
          <span>{adapterDetected ? `Adapter detected: ${shortenAddress(adapterAddress)}` : isDeploying ? 'Deploying adapter...' : ''}</span>
        </div>
      </div>
    </div>
  );
}

function MetadataStep({
  vaultName,
  vaultSymbol,
  onNameChange,
  onSymbolChange,
}: {
  vaultName: string;
  vaultSymbol: string;
  onNameChange: (value: string) => void;
  onSymbolChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4 font-zen">
      <p className="text-sm text-secondary">Set your vault's name and symbol. Both fields are required to continue.</p>
      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-[11px] uppercase text-secondary">Vault name *</span>
          <Input
            size="sm"
            value={vaultName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g., Automonarch USD"
            maxLength={MAX_NAME_LENGTH}
            classNames={{
              input: 'text-sm',
              inputWrapper: 'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
            }}
          />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] uppercase text-secondary">Vault symbol *</span>
          <Input
            size="sm"
            value={vaultSymbol}
            onChange={(event) => onSymbolChange(event.target.value)}
            placeholder="e.g., aMUSD"
            maxLength={MAX_SYMBOL_LENGTH}
            classNames={{
              input: 'text-sm',
              inputWrapper: 'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FinalizeSetupStep({
  adapter,
  registryAddress,
  isInitializing,
}: {
  adapter: Address;
  registryAddress: Address;
  isInitializing: boolean;
}) {
  const adapterIsReady = adapter !== ZERO_ADDRESS;

  return (
    <div className="space-y-4 font-zen">
      <p className="text-sm text-secondary">Review your configuration and complete the vault initialization.</p>
      <div className="rounded bg-hovered/60 p-4 text-sm space-y-3">
        <div className="space-y-1">
          <span className="text-xs uppercase text-secondary">Adapter</span>
          {adapterIsReady ? (
            <div className="text-xs text-secondary">{shortenAddress(adapter)}</div>
          ) : (
            <span className="text-xs text-secondary">Adapter not detected yet.</span>
          )}
        </div>
        <div className="space-y-1">
          <span className="text-xs uppercase text-secondary">Morpho registry</span>
          <div className="text-xs text-secondary">{shortenAddress(registryAddress)}</div>
        </div>
      </div>
    </div>
  );
}

function AgentSelectionStep({
  selectedAgent,
  onSelectAgent,
}: {
  selectedAgent: Address | null;
  onSelectAgent: (agent: Address | null) => void;
}) {
  return (
    <div className="space-y-4 font-zen">
      <p className="text-sm text-secondary">
        Choose an allocator to automate your vault's allocations. You can change this later in settings.
      </p>
      <div className="space-y-3">
        {agents.map((agent) => (
          <AllocatorCard
            key={agent.address}
            name={agent.name}
            address={agent.address as Address}
            description={agent.strategyDescription}
            image={agent.image}
            isSelected={selectedAgent === (agent.address as Address)}
            onSelect={() => onSelectAgent(selectedAgent === (agent.address as Address) ? null : (agent.address as Address))}
          />
        ))}
      </div>
    </div>
  );
}

const MAX_NAME_LENGTH = 64;
const MAX_SYMBOL_LENGTH = 16;

/**
 * VaultInitializationModal - Completely self-contained modal component.
 * Reads all data directly from Zustand stores and hooks - no props needed!
 *
 * Open this modal using: useVaultInitializationModalStore().open()
 */
export function VaultInitializationModal() {
  // Modal state from Zustand (UI state)
  const { isOpen, close } = useVaultInitializationModalStore();
  const { address: connectedAccount } = useConnection();

  // Get vault address and chain ID from URL params
  const { chainId: chainIdParam, vaultAddress } = useParams<{
    chainId: string;
    vaultAddress: string;
  }>();

  const vaultAddressValue = vaultAddress as Address;

  const chainId = useMemo(() => {
    const parsed = Number(chainIdParam);
    if (Number.isFinite(parsed) && ALL_SUPPORTED_NETWORKS.includes(parsed as SupportedNetworks)) {
      return parsed as SupportedNetworks;
    }
    return SupportedNetworks.Base;
  }, [chainIdParam]);

  // Cache for pushing known keys after init (instant RPC data on next refetch)
  const { addAllocators, addAdapters } = useVaultKeysCache(vaultAddress, chainId);

  // Fetch vault data
  const vaultDataQuery = useVaultV2Data({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  // Transaction success handler
  const handleTransactionSuccess = useCallback(() => {
    void vaultDataQuery.refetch();
  }, [vaultDataQuery]);

  // Fetch vault contract state and actions
  const vaultContract = useVaultV2({
    vaultAddress: vaultAddressValue,
    chainId,
    onTransactionSuccess: handleTransactionSuccess,
  });

  const { completeInitialization, isInitializing } = vaultContract;

  // Fetch adapter
  const { morphoMarketV1Adapter: marketAdapter, refetch: refetchAdapter } = useMorphoMarketV1Adapters({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<Address | null>((agents.at(0)?.address as Address) ?? null);
  const [vaultName, setVaultName] = useState<string>('');
  const [vaultSymbol, setVaultSymbol] = useState<string>('');
  const [deployedAdapter, setDeployedAdapter] = useState<Address>(ZERO_ADDRESS);
  const currentStep = STEP_SEQUENCE[stepIndex];

  const publicClient = usePublicClient({ chainId });

  const registryAddress = useMemo(() => {
    if (!chainId) return ZERO_ADDRESS;
    const configured = getNetworkConfig(chainId).autovaultAddresses?.morphoRegistry;
    return (configured as Address | undefined) ?? ZERO_ADDRESS;
  }, [chainId]);

  // Adapter is detected if it exists in the subgraph OR we just deployed it
  const adapterAddress = deployedAdapter !== ZERO_ADDRESS ? deployedAdapter : (marketAdapter ?? ZERO_ADDRESS);
  const adapterDetected = adapterAddress !== ZERO_ADDRESS;

  const { deploy, isDeploying, canDeploy } = useDeployMorphoMarketV1Adapter({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  const handleDeploy = useCallback(async () => {
    if (!publicClient) return;

    try {
      // Execute deployment and get transaction hash
      const txHash = await deploy();

      if (!txHash) {
        return;
      }

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Parse CreateMorphoMarketV1AdapterV2 event to get adapter address
      const createEvent = receipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({
            abi: adapterFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'CreateMorphoMarketV1AdapterV2';
        } catch {
          return false;
        }
      });

      if (createEvent) {
        const decoded = decodeEventLog({
          abi: adapterFactoryAbi,
          data: createEvent.data,
          topics: createEvent.topics,
        });

        // Extract adapter address from event
        const adapter = (decoded.args as any).morphoMarketV1AdapterV2 as Address;
        setDeployedAdapter(adapter);

        // Cache immediately so RPC validation picks it up
        addAdapters([adapter]);

        // Trigger refetch for adapter detection
        void refetchAdapter();

        // Auto-advance to next step
        setStepIndex(1);
      }
    } catch (_error) {
      // Error is handled by useDeployMorphoMarketV1Adapter hook
    }
  }, [deploy, publicClient, refetchAdapter, addAdapters]);

  const handleCompleteInitialization = useCallback(async () => {
    if (adapterAddress === ZERO_ADDRESS || registryAddress === ZERO_ADDRESS || !vaultAddress || !chainId) return;

    try {
      // Note: Adapter cap will be set when user configures market caps
      // Pass name and symbol if provided (will be trimmed and checked in useVaultV2)
      const success = await completeInitialization(
        registryAddress,
        adapterAddress,
        selectedAgent ?? undefined,
        vaultName || undefined,
        vaultSymbol || undefined,
      );
      if (!success) {
        return;
      }

      // Push known keys to cache so RPC fetches them instantly on next refetch
      const allocatorsToCache: string[] = [];
      if (connectedAccount) {
        allocatorsToCache.push(connectedAccount);
      }
      if (selectedAgent) {
        allocatorsToCache.push(selectedAgent);
      }
      if (allocatorsToCache.length > 0) {
        addAllocators(allocatorsToCache);
      }
      if (adapterAddress !== ZERO_ADDRESS) {
        addAdapters([adapterAddress]);
      }

      // Trigger refetch — cache keys are now available, RPC will return fresh data
      void vaultDataQuery.refetch();
      void vaultContract.refetch();
      void refetchAdapter();

      close();
    } catch (_error) {
      // Error is handled by useVaultV2 hook (toast shown to user)
    }
  }, [
    completeInitialization,
    vaultDataQuery,
    vaultContract,
    refetchAdapter,
    close,
    addAllocators,
    addAdapters,
    connectedAccount,
    registryAddress,
    selectedAgent,
    adapterAddress,
    vaultName,
    vaultSymbol,
    vaultAddress,
    vaultAddressValue,
    chainId,
  ]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setSelectedAgent((agents.at(0)?.address as Address) ?? null);
      setVaultName('');
      setVaultSymbol('');
      setDeployedAdapter(ZERO_ADDRESS);
    }
  }, [isOpen]);

  // Auto-advance when adapter already exists (from subgraph)
  useEffect(() => {
    if (marketAdapter !== ZERO_ADDRESS && stepIndex === 0 && deployedAdapter === ZERO_ADDRESS) {
      setStepIndex(1);
    }
  }, [marketAdapter, stepIndex, deployedAdapter]);

  const stepTitle = useMemo(() => {
    switch (currentStep) {
      case 'deploy':
        return 'Deploy Morpho Market adapter';
      case 'metadata':
        return 'Set vault name & symbol';
      case 'agents':
        return 'Choose an Allocator';
      case 'finalize':
        return 'Review & finalize';
      default:
        return '';
    }
  }, [currentStep]);

  const renderCta = () => {
    // Step 0: Deploy adapter
    if (stepIndex === 0) {
      return (
        <Button
          variant="primary"
          className="min-w-[150px]"
          disabled={!canDeploy || isDeploying}
          onClick={() => void handleDeploy()}
        >
          {isDeploying ? (
            <span className="flex items-center gap-2">
              <Spinner size={12} /> Deploying...
            </span>
          ) : (
            'Deploy adapter'
          )}
        </Button>
      );
    }

    // Step 1: Metadata (required)
    if (stepIndex === 1) {
      const isValid = vaultName.trim().length > 0 && vaultSymbol.trim().length > 0;
      return (
        <Button
          variant="primary"
          className="min-w-[150px]"
          disabled={!isValid}
          onClick={() => setStepIndex(2)}
        >
          Continue
        </Button>
      );
    }

    // Step 2: Agent selection (required)
    if (stepIndex === 2) {
      return (
        <Button
          variant="primary"
          className="min-w-[150px]"
          disabled={!selectedAgent}
          onClick={() => setStepIndex(3)}
        >
          Continue
        </Button>
      );
    }

    // Step 3: Finalize - execute initialization
    return (
      <Button
        variant="primary"
        className="min-w-[170px]"
        disabled={isInitializing}
        onClick={() => void handleCompleteInitialization()}
      >
        {isInitializing ? (
          <span className="flex items-center gap-2">
            <Spinner size={12} /> Completing...
          </span>
        ) : (
          'Complete setup'
        )}
      </Button>
    );
  };

  // Don't render if required data is missing
  if (!isOpen || !vaultAddress || !chainId) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      size="lg"
      scrollBehavior="inside"
      className="bg-background dark:border border-gray-700"
    >
      <ModalHeader
        title={stepTitle}
        description="Complete vault initialization to start using your vault"
        mainIcon={<FiZap className="h-5 w-5" />}
        onClose={close}
      />
      <ModalBody className="space-y-6 px-6 py-8">
        {currentStep === 'deploy' && (
          <DeployAdapterStep
            isDeploying={isDeploying}
            adapterDetected={adapterDetected}
            adapterAddress={adapterAddress}
          />
        )}
        {currentStep === 'metadata' && (
          <MetadataStep
            vaultName={vaultName}
            vaultSymbol={vaultSymbol}
            onNameChange={setVaultName}
            onSymbolChange={setVaultSymbol}
          />
        )}
        {currentStep === 'finalize' && (
          <FinalizeSetupStep
            adapter={adapterAddress}
            registryAddress={registryAddress}
            isInitializing={isInitializing}
          />
        )}
        {currentStep === 'agents' && (
          <AgentSelectionStep
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
          />
        )}
      </ModalBody>
      <ModalFooter className="flex flex-col items-center gap-4 border-t border-divider/40 pt-6 px-8 pb-6">
        <StepIndicator currentStep={currentStep} />
        <div className="flex items-center gap-3">{renderCta()}</div>
      </ModalFooter>
    </Modal>
  );
}

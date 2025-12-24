'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { FiZap } from 'react-icons/fi';
import { type Address, zeroAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AllocatorCard } from '@/components/shared/allocator-card';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Spinner } from '@/components/ui/spinner';
import { useDeployMorphoMarketV1Adapter } from '@/hooks/useDeployMorphoMarketV1Adapter';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { v2AgentsBase } from '@/utils/monarch-agent';
import { getMorphoAddress } from '@/utils/morpho';
import { type SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { startVaultIndexing } from '@/utils/vault-indexing';

const ZERO_ADDRESS = zeroAddress;
const shortenAddress = (value: Address | string) => (value === ZERO_ADDRESS ? '0x0000…0000' : `${value.slice(0, 6)}…${value.slice(-4)}`);

const STEP_SEQUENCE = ['deploy', 'metadata', 'agents', 'finalize'] as const;

// Polling configuration constants
const ADAPTER_POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds for adapter deployment
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
  isChecking,
  adapterDetected,
  adapterAddress,
  justDeployed,
}: {
  isDeploying: boolean;
  isChecking: boolean;
  adapterDetected: boolean;
  adapterAddress: Address;
  justDeployed: boolean;
}) {
  return (
    <div className="space-y-4 font-zen">
      <p className="text-sm text-secondary">Deploy a Morpho Market adapter so this vault can allocate assets into Morpho Blue markets.</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-secondary">
          {(isDeploying || isChecking) && <Spinner size={12} />}
          <span>
            {adapterDetected
              ? `Adapter detected: ${shortenAddress(adapterAddress)}`
              : justDeployed && isChecking
                ? 'Indexing your adapter...'
                : isChecking
                  ? 'Checking for adapter...'
                  : 'Adapter not detected yet. Click deploy to create one.'}
          </span>
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
      <p className="text-sm text-secondary">Choose an agent to automate your vault's allocations. You can change this later in settings.</p>
      <div className="space-y-3">
        {v2AgentsBase.map((agent) => (
          <AllocatorCard
            key={agent.address}
            name={agent.name}
            address={agent.address as Address}
            description={agent.strategyDescription}
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

export function VaultInitializationModal({
  isOpen,
  onOpenChange,
  vaultAddress,
  marketAdapter, // address of MorphoMakretV1Aapater
  marketAdapterLoading, //
  refetchMarketAdapter, // refetch all "depolyed market adapter"
  chainId,
  onAdapterConfigured,
}: {
  isOpen: boolean;
  marketAdapter: Address;
  marketAdapterLoading: boolean;
  refetchMarketAdapter: () => void;
  onOpenChange: (open: boolean) => void;
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onAdapterConfigured: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [statusVisible, setStatusVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Address | null>(null);
  const [vaultName, setVaultName] = useState<string>('');
  const [vaultSymbol, setVaultSymbol] = useState<string>('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentStep = STEP_SEQUENCE[stepIndex];

  const morphoAddress = useMemo(() => getMorphoAddress(chainId), [chainId]);
  const registryAddress = useMemo(() => {
    const configured = getNetworkConfig(chainId).vaultConfig?.morphoRegistry;
    return (configured as Address | undefined) ?? ZERO_ADDRESS;
  }, [chainId]);

  const { completeInitialization, isInitializing } = useVaultV2({
    vaultAddress,
    chainId,
  });

  const adapterDetected = marketAdapter !== ZERO_ADDRESS;

  const { deploy, isDeploying, canDeploy } = useDeployMorphoMarketV1Adapter({
    vaultAddress,
    chainId,
    morphoAddress,
  });

  const handleDeploy = useCallback(async () => {
    setStatusVisible(true);
    try {
      await deploy();
      // Polling will continue automatically (already running from modal open effect)
      void refetchMarketAdapter(); // Immediate check after deploy
    } catch (_error) {
      // Error is handled by useDeployMorphoMarketV1Adapter hook
      setStatusVisible(false);
    }
  }, [deploy, refetchMarketAdapter]);

  const handleCompleteInitialization = useCallback(async () => {
    if (marketAdapter === ZERO_ADDRESS || registryAddress === ZERO_ADDRESS) return;

    try {
      // Note: Adapter cap will be set when user configures market caps
      // Pass name and symbol if provided (will be trimmed and checked in useVaultV2)
      const success = await completeInitialization(
        registryAddress,
        marketAdapter,
        selectedAgent ?? undefined,
        vaultName || undefined,
        vaultSymbol || undefined,
      );
      if (!success) {
        return;
      }

      // Start indexing mode - vault page will handle retry logic
      startVaultIndexing(vaultAddress, chainId);

      // Trigger initial refetch
      void onAdapterConfigured();

      onOpenChange(false);
    } catch (_error) {
      // Error is handled by useVaultV2 hook (toast shown to user)
    }
  }, [
    completeInitialization,
    onAdapterConfigured,
    onOpenChange,
    registryAddress,
    selectedAgent,
    marketAdapter,
    vaultName,
    vaultSymbol,
    vaultAddress,
    chainId,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setStatusVisible(false);
      setSelectedAgent(null);
      setVaultName('');
      setVaultSymbol('');

      // Clean up adapter polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen]);

  // Auto-poll for adapter when modal is open and adapter not detected (vault-specific)
  useEffect(() => {
    if (!isOpen || adapterDetected) {
      return;
    }

    // Initial check immediately
    void refetchMarketAdapter();

    // Poll for adapter deployment
    pollingIntervalRef.current = setInterval(() => {
      void refetchMarketAdapter();
    }, ADAPTER_POLLING_INTERVAL_MS);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isOpen, adapterDetected, refetchMarketAdapter]);

  // Detection effect: Auto-advance when adapter found
  useEffect(() => {
    if (adapterDetected && stepIndex === 0) {
      setStepIndex(1);
    }
  }, [adapterDetected, stepIndex]);

  const stepTitle = useMemo(() => {
    switch (currentStep) {
      case 'deploy':
        return 'Deploy Morpho Market adapter';
      case 'metadata':
        return 'Set vault name & symbol';
      case 'agents':
        return 'Choose an agent';
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
          disabled={!canDeploy || isDeploying || marketAdapterLoading}
          onClick={() => void handleDeploy()}
        >
          {isDeploying ? (
            <span className="flex items-center gap-2">
              <Spinner size={12} /> Deploying...
            </span>
          ) : marketAdapterLoading ? (
            <span className="flex items-center gap-2">
              <Spinner size={12} /> Checking...
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

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      scrollBehavior="inside"
      className="bg-background dark:border border-gray-700"
    >
      <ModalHeader
        title={stepTitle}
        description="Complete vault initialization to start using your vault"
        mainIcon={<FiZap className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="space-y-6 px-8 py-6">
        {currentStep === 'deploy' && (
          <DeployAdapterStep
            isDeploying={isDeploying}
            isChecking={marketAdapterLoading}
            adapterDetected={adapterDetected}
            adapterAddress={marketAdapter}
            justDeployed={statusVisible}
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
            adapter={marketAdapter}
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

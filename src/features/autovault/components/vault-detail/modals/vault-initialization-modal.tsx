'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiZap } from 'react-icons/fi';
import { type Address, formatUnits, zeroAddress } from 'viem';
import { useParams } from 'next/navigation';
import { usePublicClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Input } from '@/components/ui/input';
import { AllocatorCard } from '@/components/shared/allocator-card';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Spinner } from '@/components/ui/spinner';
import { useDeployMorphoMarketAdapter } from '@/hooks/useDeployMorphoMarketAdapter';
import { useMorphoMarketAdapters } from '@/hooks/useMorphoMarketAdapters';
import { useVaultQueryRefresh } from '@/hooks/useVaultQueryRefresh';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { v2AgentsBase } from '@/utils/monarch-agent';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { useVaultInitializationModalStore } from '@/stores/vault-initialization-modal-store';
import { useVaultV2InitializationStatus } from '@/hooks/useVaultV2InitializationStatus';
import type { VaultV2DeadDeposit } from '@/data-sources/rpc/vault-dead-deposit';

const ZERO_ADDRESS = zeroAddress;
const MORPHO_MARKET_ADAPTER_V2_CREATED_TOPIC = '0x2d5aa62fff752ff7caa68d3c82c1ae04ccb2053bd3be0ffee086953f6adc894e';
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
  isCheckingAdapter,
  adapterDetected,
  adapterAddress,
}: {
  isDeploying: boolean;
  isCheckingAdapter: boolean;
  adapterDetected: boolean;
  adapterAddress: Address;
}) {
  return (
    <div className="space-y-4 font-zen">
      <p className="text-sm text-secondary">Deploy a Morpho Market adapter so this vault can allocate assets into Morpho Blue markets.</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-secondary">
          {(isDeploying || isCheckingAdapter) && <Spinner size={12} />}
          <span>
            {adapterDetected
              ? `Adapter detected: ${shortenAddress(adapterAddress)}`
              : isDeploying
                ? 'Deploying adapter...'
                : isCheckingAdapter
                  ? 'Checking adapter...'
                  : ''}
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
  seed,
  tokenSymbol,
}: {
  adapter: Address;
  registryAddress: Address;
  seed?: VaultV2DeadDeposit;
  tokenSymbol: string;
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
        <div className="space-y-1">
          <span className="text-xs uppercase text-secondary">Dead deposit</span>
          <p className="text-sm text-secondary">
            {seed
              ? seed.isSeeded
                ? 'Required dead shares are already present. No additional seed will be spent.'
                : `${formatUnits(seed.assets, seed.assetDecimals)} ${tokenSymbol} will be permanently locked to protect the initial share price. This amount cannot be withdrawn.`
              : 'Checking the vault and seed amount...'}
          </p>
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
        {v2AgentsBase.map((agent) => (
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

  // Fetch vault data
  const vaultDataQuery = useVaultV2Data({
    vaultAddress: vaultAddressValue,
    chainId,
  });
  const [initializationError, setInitializationError] = useState<string | null>(null);

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
  const { refetch: refetchVaultQueries } = useVaultQueryRefresh({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  // Fetch adapter
  const {
    primaryAdapter: marketAdapter,
    refetch: refetchAdapter,
    isLoading: isAdapterLoading,
    isFetching: isAdapterFetching,
  } = useMorphoMarketAdapters({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<Address | null>((v2AgentsBase.at(0)?.address as Address) ?? null);
  const [vaultName, setVaultName] = useState<string>('');
  const [vaultSymbol, setVaultSymbol] = useState<string>('');
  const [deployedAdapter, setDeployedAdapter] = useState<Address>(ZERO_ADDRESS);

  const publicClient = usePublicClient({ chainId });
  const registryAddress = useMemo(() => {
    if (!chainId) return ZERO_ADDRESS;
    const configured = getNetworkConfig(chainId).vaultConfig?.morphoRegistry;
    return (configured as Address | undefined) ?? ZERO_ADDRESS;
  }, [chainId]);

  // Adapter is detected if Monarch has indexed it or we just deployed it locally.
  const adapterAddress = deployedAdapter === ZERO_ADDRESS ? (marketAdapter ?? ZERO_ADDRESS) : deployedAdapter;
  const adapterDetected = adapterAddress !== ZERO_ADDRESS;
  const { deadDeposit, refetch: refetchSetupStatus } = useVaultV2InitializationStatus({
    vaultAddress: vaultAddressValue,
    chainId,
    adapterAddress,
  });
  const currentStep =
    deadDeposit.data && !deadDeposit.data.isSeeded && (deadDeposit.data.totalSupply !== 0n || deadDeposit.data.totalAssets !== 0n)
      ? 'review'
      : STEP_SEQUENCE[stepIndex];
  const isCheckingAdapter = (isAdapterLoading || isAdapterFetching) && !adapterDetected;

  const { deploy, isDeploying, canDeploy, factoryAddress } = useDeployMorphoMarketAdapter({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  const handleDeploy = useCallback(async () => {
    if (!publicClient || !factoryAddress) return;

    try {
      const txHash = await deploy();
      if (!txHash) {
        return;
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      void refetchAdapter();

      const createEvent = receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
          return false;
        }
        return log.topics[0] === MORPHO_MARKET_ADAPTER_V2_CREATED_TOPIC && Boolean(log.topics[2]);
      });

      if (createEvent && createEvent.topics[2]) {
        const adapter = `0x${createEvent.topics[2].slice(-40)}` as Address;
        setDeployedAdapter(adapter.toLowerCase() as Address);
        setStepIndex(1);
      }
    } catch (_error) {
      // Error is handled by useDeployMorphoMarketAdapter hook
    }
  }, [deploy, factoryAddress, publicClient, refetchAdapter]);

  const handleCompleteInitialization = useCallback(async () => {
    if (adapterAddress === ZERO_ADDRESS || registryAddress === ZERO_ADDRESS || !vaultAddress || !chainId) return;

    setInitializationError(null);
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

      await Promise.all([refetchVaultQueries({ includeRetries: true }), refetchSetupStatus()]);

      close();
    } catch (error) {
      setInitializationError(error instanceof Error ? error.message : 'Unable to complete vault setup. Please try again.');
      void deadDeposit.refetch();
    }
  }, [
    completeInitialization,
    close,
    refetchVaultQueries,
    refetchSetupStatus,
    registryAddress,
    selectedAgent,
    adapterAddress,
    vaultName,
    vaultSymbol,
    vaultAddress,
    vaultAddressValue,
    chainId,
    deadDeposit.refetch,
  ]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setSelectedAgent((v2AgentsBase.at(0)?.address as Address) ?? null);
      setVaultName('');
      setVaultSymbol('');
      setDeployedAdapter(ZERO_ADDRESS);
      setInitializationError(null);
    }
  }, [isOpen]);

  // Auto-advance when adapter already exists in Monarch data.
  useEffect(() => {
    if (adapterDetected && stepIndex === 0) {
      setStepIndex(1);
    }
  }, [adapterDetected, stepIndex]);

  const canCompleteInitialization =
    adapterAddress !== ZERO_ADDRESS &&
    registryAddress !== ZERO_ADDRESS &&
    !deadDeposit.isError &&
    !!deadDeposit.data &&
    (deadDeposit.data.isSeeded || (deadDeposit.data.totalSupply === 0n && deadDeposit.data.totalAssets === 0n));

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
      case 'review':
        return 'Review existing deposits';
      default:
        return '';
    }
  }, [currentStep]);

  const renderCta = () => {
    if (currentStep === 'review') {
      return (
        <Button
          variant="primary"
          onClick={close}
        >
          Close
        </Button>
      );
    }
    // Step 0: Deploy adapter
    if (stepIndex === 0) {
      return (
        <Button
          variant="primary"
          className="min-w-[150px]"
          disabled={!canDeploy || isDeploying || isCheckingAdapter}
          onClick={() => void handleDeploy()}
        >
          {isDeploying || isCheckingAdapter ? (
            <span className="flex items-center gap-2">
              <Spinner size={12} /> {isDeploying ? 'Deploying...' : 'Checking...'}
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
      <ExecuteTransactionButton
        targetChainId={chainId}
        variant="primary"
        className="min-w-[170px]"
        isLoading={isInitializing}
        disabled={isInitializing || !canCompleteInitialization}
        onClick={() => void handleCompleteInitialization()}
      >
        {isInitializing ? 'Completing...' : deadDeposit.data?.isSeeded ? 'Complete setup' : 'Approve & complete setup'}
      </ExecuteTransactionButton>
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
        {currentStep === 'review' && (
          <p
            role="alert"
            className="text-sm text-secondary"
          >
            This vault already has deposits without the required dead shares. The initial dead deposit must come before user deposits.
            Review its first deposit and share price before deciding how to proceed; this setup flow cannot repair it retroactively.
          </p>
        )}
        {currentStep === 'deploy' && (
          <DeployAdapterStep
            isDeploying={isDeploying}
            isCheckingAdapter={isCheckingAdapter}
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
            seed={deadDeposit.data}
            tokenSymbol={vaultDataQuery.data?.tokenSymbol ?? 'tokens'}
          />
        )}
        {currentStep === 'finalize' && deadDeposit.isError && (
          <div
            role="alert"
            className="space-y-2 text-sm text-red-500"
          >
            <p>Unable to verify the dead deposit. Try again before completing setup.</p>
            <Button
              variant="ghost"
              onClick={() => void deadDeposit.refetch()}
              disabled={deadDeposit.isFetching}
            >
              Retry check
            </Button>
          </div>
        )}
        {initializationError && (
          <p
            role="alert"
            className="text-sm text-red-500"
          >
            {initializationError}
          </p>
        )}
        {currentStep === 'agents' && (
          <AgentSelectionStep
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
          />
        )}
      </ModalBody>
      <ModalFooter className="flex flex-col items-center gap-4 border-t border-divider/40 pt-6 px-8 pb-6">
        {currentStep !== 'review' && <StepIndicator currentStep={currentStep} />}
        <div className="flex items-center gap-3">{renderCta()}</div>
      </ModalFooter>
    </Modal>
  );
}

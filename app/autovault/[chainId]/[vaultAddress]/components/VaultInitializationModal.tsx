import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { Address, zeroAddress } from 'viem';
import { Button } from '@/components/common';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { AllocatorCard } from '@/components/common/AllocatorCard';
import { Spinner } from '@/components/common/Spinner';
import { useDeployMorphoMarketV1Adapter } from '@/hooks/useDeployMorphoMarketV1Adapter';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { v2AgentsBase } from '@/utils/monarch-agent';
import { getMorphoAddress } from '@/utils/morpho';
import { SupportedNetworks, getNetworkConfig } from '@/utils/networks';

const ZERO_ADDRESS = zeroAddress;
const shortenAddress = (value: Address | string) =>
  value === ZERO_ADDRESS ? '0x0000…0000' : `${value.slice(0, 6)}…${value.slice(-4)}`;

const STEP_SEQUENCE = ['deploy', 'adapter-cap', 'finalize', 'agents'] as const;
type StepId = (typeof STEP_SEQUENCE)[number];

function StepIndicator({ currentStep }: { currentStep: StepId }) {
  const currentIndex = STEP_SEQUENCE.findIndex((s) => s === currentStep);

  return (
    <div className="flex w-full items-center justify-center gap-2">
      {STEP_SEQUENCE.map((step, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`h-[6px] w-8 rounded transition-colors duration-300 ${
                isCurrent ? 'bg-primary' : isPast ? 'bg-primary/50' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

function DeployAdapterStep({
  loading,
  adapterDetected,
  adapterAddress,
}: {
  loading: boolean;
  adapterDetected: boolean;
  adapterAddress: Address;
}) {
  return (
    <div className="space-y-4 px-2 font-zen">
      <p className="text-sm text-secondary">
        Deploy a Morpho Market adapter so this vault can allocate assets into Morpho Blue markets.
      </p>
      <div className="flex items-center gap-2 text-xs text-secondary">
        {loading && <Spinner size={12} />}
        <span>
          {adapterDetected
            ? `Adapter detected: ${shortenAddress(adapterAddress)}`
            : 'Adapter not detected yet.'}
        </span>
      </div>
    </div>
  );
}

function AdapterCapStep({
  adapterAddress,
  adapterCapRelative,
  onSetAdapterCap,
}: {
  adapterAddress: Address;
  adapterCapRelative: string;
  onSetAdapterCap: (relativeCap: string) => void;
}) {
  const handleCapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty or valid numbers between 0-100
    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
      onSetAdapterCap(value);
    }
  };

  return (
    <div className="space-y-4 px-2 font-zen">
      <p className="text-sm text-secondary">
        Set a maximum allocation cap for the Morpho adapter. This controls the total percentage of vault assets that can be allocated through this adapter.
      </p>
      <div className="rounded bg-hovered/60 p-4 space-y-4">
        <div className="space-y-1">
          <span className="text-xs uppercase text-secondary">Adapter address</span>
          <AddressDisplay address={adapterAddress} />
        </div>
        <div className="space-y-2">
          <span className="text-xs uppercase text-secondary">Adapter cap (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={adapterCapRelative}
            onChange={handleCapChange}
            className="w-full rounded border border-divider bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            placeholder="e.g., 80"
          />
          <p className="text-xs text-secondary">
            Maximum percentage of vault assets that can be allocated via this adapter (0-100%)
          </p>
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
    <div className="space-y-4 px-2 font-zen">
      <div className="flex items-center gap-2 text-sm text-secondary">
        {isInitializing && <Spinner size={12} />}
        <span>
          Link the vault to the adapter and commit to the Morpho registry. This permanently opts
          the vault into Morpho-approved adapters.
        </span>
      </div>
      <div className="rounded bg-hovered/60 p-4 text-sm space-y-4">
        <div className="space-y-1">
          <span className="text-xs uppercase text-secondary">Adapter</span>
          {adapterIsReady ? (
            <AddressDisplay address={adapter} />
          ) : (
            <span className="text-xs text-secondary">Adapter not detected yet.</span>
          )}
        </div>
        <div className="space-y-1">
          <span className="text-xs uppercase text-secondary">Morpho registry</span>
          <AddressDisplay address={registryAddress} />
        </div>
        <ul className="list-disc space-y-1 pl-4 text-xs text-secondary">
          <li>Only Morpho-approved adapters can be enabled after this step.</li>
          <li>Registry configuration is abdicated and cannot be reversed.</li>
        </ul>
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
    <div className="space-y-4 px-2 font-zen">
      <p className="text-sm text-secondary">
        Choose an agent to automate your vault's allocations. You can change this later in settings.
      </p>
      <div className="space-y-3">
        {v2AgentsBase.map((agent) => (
          <AllocatorCard
            key={agent.address}
            name={agent.name}
            address={agent.address as Address}
            description={agent.strategyDescription}
            isSelected={selectedAgent === (agent.address as Address)}
            onSelect={() =>
              onSelectAgent(
                selectedAgent === (agent.address as Address) ? null : (agent.address as Address),
              )
            }
          />
        ))}
      </div>
      <p className="text-xs text-secondary italic">
        💡 Tip: Agents help maximize returns by rebalancing between markets. You can skip this and
        configure later.
      </p>
    </div>
  );
}

export function VaultInitializationModal({
  isOpen,
  onClose,
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
  onClose: () => void;
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onAdapterConfigured: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [statusVisible, setStatusVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Address | null>(null);
  const [adapterCapRelative, setAdapterCapRelative] = useState<string>('100');
  const currentStep = STEP_SEQUENCE[stepIndex];

  const morphoAddress = useMemo(() => getMorphoAddress(chainId), [chainId]);
  const registryAddress = useMemo(() => {
    const configured = getNetworkConfig(chainId).vaultConfig?.morphoRegistry;
    return (configured as Address | undefined) ?? ZERO_ADDRESS;
  }, [chainId]);
  
  const {
    completeInitialization,
    isInitializing,
  } = useVaultV2({
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
    await deploy();
    void refetchMarketAdapter();
  }, [deploy, refetchMarketAdapter]);


  const handleCompleteInitialization = useCallback(async () => {
    if (marketAdapter === ZERO_ADDRESS || registryAddress === ZERO_ADDRESS) return;

    try {
      const success = await completeInitialization(
        registryAddress,
        marketAdapter,
        selectedAgent ?? undefined,
      );
      if (!success) {
        return;
      }
      onAdapterConfigured();
      onClose();
    } catch (error) {
      console.error('Failed to complete initialization', error);
    }
  }, [
    completeInitialization,
    onAdapterConfigured,
    onClose,
    registryAddress,
    selectedAgent,
    marketAdapter,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setStatusVisible(false);
      setSelectedAgent(null);
      setAdapterCapRelative('100');
    }
  }, [isOpen]);

  useEffect(() => {
    if (adapterDetected && stepIndex === 0) {
      setStepIndex(1);
    }
  }, [adapterDetected, stepIndex]);

  const stepTitle = useMemo(() => {
    switch (currentStep) {
      case 'deploy':
        return 'Deploy Morpho Market adapter';
      case 'adapter-cap':
        return 'Set adapter allocation cap';
      case 'finalize':
        return 'Configure vault registry';
      case 'agents':
        return 'Choose an agent (optional)';
      default:
        return '';
    }
  }, [currentStep]);

  const canProceedToAgents = adapterDetected && registryAddress !== ZERO_ADDRESS;
  const showLoading = statusVisible && (isDeploying || marketAdapterLoading);
  const showBackButton = stepIndex > 0 && stepIndex < 3;
  const canProceedFromAdapterCap = adapterCapRelative !== '' && parseFloat(adapterCapRelative) > 0;

  const renderCta = () => {
    // Step 0: Deploy adapter
    if (stepIndex === 0) {
      return (
        <Button
          variant="cta"
          size="sm"
          className="min-w-[150px]"
          isDisabled={!canDeploy || isDeploying}
          onPress={() => void handleDeploy()}
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

    // Step 1: Set adapter cap
    if (stepIndex === 1) {
      return (
        <Button
          variant="cta"
          size="sm"
          className="min-w-[150px]"
          isDisabled={!canProceedFromAdapterCap}
          onPress={() => setStepIndex(2)}
        >
          Next: Finalize setup
        </Button>
      );
    }

    // Step 2: Finalize setup -> move to agent selection
    if (stepIndex === 2) {
      return (
        <Button
          variant="cta"
          size="sm"
          className="min-w-[170px]"
          isDisabled={!canProceedToAgents}
          onPress={() => setStepIndex(3)}
        >
          Next: Choose agent
        </Button>
      );
    }

    // Step 3: Agent selection -> complete with optional agent
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="min-w-[120px]"
          onPress={() => void handleCompleteInitialization()}
          isDisabled={isInitializing}
        >
          Skip for now
        </Button>
        <Button
          variant="cta"
          size="sm"
          className="min-w-[170px]"
          isDisabled={isInitializing}
          onPress={() => void handleCompleteInitialization()}
        >
          {isInitializing ? (
            <span className="flex items-center gap-2">
              <Spinner size={12} /> Completing...
            </span>
          ) : (
            'Complete setup'
          )}
        </Button>
      </>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-background dark:border border-gray-700 font-zen',
        body: 'py-6',
      }}
    >
      <ModalContent className="p-4 font-zen">
        <ModalHeader className="flex-col items-start gap-1 px-10 pt-6 font-zen">
          <span className="text-lg font-normal text-primary">{stepTitle}</span>
          <span className="text-sm font-normal text-secondary">
            {stepIndex < 3
              ? 'Complete these steps to activate your vault'
              : 'Optionally choose an agent now, or configure later in settings'}
          </span>
        </ModalHeader>

        <ModalBody className="space-y-6 px-2">
          {currentStep === 'deploy' && (
            <DeployAdapterStep
              loading={showLoading}
              adapterDetected={adapterDetected}
              adapterAddress={marketAdapter}
            />
          )}
          {currentStep === 'adapter-cap' && (
            <AdapterCapStep
              adapterAddress={marketAdapter}
              adapterCapRelative={adapterCapRelative}
              onSetAdapterCap={setAdapterCapRelative}
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
            <AgentSelectionStep selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
          )}
        </ModalBody>

        <ModalFooter className="flex items-center justify-end gap-2 border-t border-divider/40 pt-4">
          {showBackButton && (
            <Button variant="ghost" size="sm" onPress={() => setStepIndex((prev) => Math.max(prev - 1, 0))}>
              Back
            </Button>
          )}
          {renderCta()}
        </ModalFooter>
        <div className="px-4 pb-2">
          <StepIndicator currentStep={currentStep} />
        </div>
      </ModalContent>
    </Modal>
  );
}

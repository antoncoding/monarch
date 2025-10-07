import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { Address, zeroAddress } from 'viem';
import { Button } from '@/components/common';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { Spinner } from '@/components/common/Spinner';
import { useDeployMorphoMarketV1Adapter } from '@/hooks/useDeployMorphoMarketV1Adapter';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { getMorphoAddress } from '@/utils/morpho';
import { SupportedNetworks, getNetworkConfig } from '@/utils/networks';

const ZERO_ADDRESS = zeroAddress;
const shortenAddress = (value: Address | string) =>
  value === ZERO_ADDRESS ? '0x0000…0000' : `${value.slice(0, 6)}…${value.slice(-4)}`;

const STEP_SEQUENCE = ['deploy', 'finalize'] as const;
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

function FinalizeSetupStep({
  adapter,
  registryAddress,
  isFinalizing,
}: {
  adapter: Address;
  registryAddress: Address;
  isFinalizing: boolean;
}) {
  const adapterIsReady = adapter !== ZERO_ADDRESS;

  return (
    <div className="space-y-4 px-2 font-zen">
      <div className="flex items-center gap-2 text-sm text-secondary">
        {isFinalizing && <Spinner size={12} />}
        <span>
          Finalize setup to link the vault to the adapter and commit to the Morpho registry. This permanently
          opts the vault into Morpho-approved adapters.
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
          <li>This step also registers the adapter on the vault.</li>
        </ul>
      </div>
    </div>
  );
}

export function VaultInitializationModal({
  isOpen,
  onClose,
  vaultAddress,
  chainId,
  onAdapterConfigured,
}: {
  isOpen: boolean;
  onClose: () => void;
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onAdapterConfigured: () => void;
}) {
  
  const [stepIndex, setStepIndex] = useState(0);
  const [statusVisible, setStatusVisible] = useState(false);
  const currentStep = STEP_SEQUENCE[stepIndex];

  const morphoAddress = useMemo(() => getMorphoAddress(chainId), [chainId]);
  const registryAddress = useMemo(() => {
    const configured = getNetworkConfig(chainId).vaultConfig?.morphoRegistry;
    return (configured as Address | undefined) ?? ZERO_ADDRESS;
  }, [chainId]);
  const {
    adapters,
    loading: adaptersLoading,
    refetch: refetchAdapters,
  } = useMorphoMarketV1Adapters({ vaultAddress, chainId });
  const subgraphAdapter = (adapters[0]?.adapter as Address | undefined) ?? ZERO_ADDRESS;

  const {
    adapter: onChainAdapter,
    refetch: refetchVault,
    finalizeSetup,
    isFinalizing,
  } = useVaultV2({
    vaultAddress,
    chainId,
  });

  const unifiedAdapter = useMemo(() => {
    if (subgraphAdapter !== ZERO_ADDRESS) return subgraphAdapter;
    if (onChainAdapter && onChainAdapter !== ZERO_ADDRESS) return onChainAdapter;
    return ZERO_ADDRESS;
  }, [onChainAdapter, subgraphAdapter]);

  const adapterDetected = unifiedAdapter !== ZERO_ADDRESS;

  const { deploy, isDeploying, canDeploy } = useDeployMorphoMarketV1Adapter({
    vaultAddress,
    chainId,
    morphoAddress,
  });


  const handleDeploy = useCallback(async () => {
    setStatusVisible(true);
    await deploy();
    await refetchAdapters();
  }, [deploy, refetchAdapters]);

  const handleAdapterDetected = useCallback(async () => {
    await refetchVault();
    onAdapterConfigured();
  }, [onAdapterConfigured, refetchVault]);

  const handleFinalize = useCallback(async () => {
    if (unifiedAdapter === ZERO_ADDRESS || registryAddress === ZERO_ADDRESS) return;

    try {
      const success = await finalizeSetup(registryAddress, unifiedAdapter);
      if (!success) {
        return;
      }

      await refetchVault();
      onAdapterConfigured();
      onClose();
    } catch (error) {
      console.error('Failed to finalize setup', error);
    }
  }, [finalizeSetup, onAdapterConfigured, onClose, refetchVault, registryAddress, unifiedAdapter]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setStatusVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (adapterDetected && stepIndex === 0) {
      setStepIndex(1);
      void handleAdapterDetected();
    }
  }, [adapterDetected, handleAdapterDetected, stepIndex]);

  const stepTitle = useMemo(() => {
    switch (currentStep) {
      case 'deploy':
        return 'Deploy Morpho Market adapter';
      case 'finalize':
        return 'Finalize setup';
      default:
        return '';
    }
  }, [currentStep]);

  const canFinalize = adapterDetected && registryAddress !== ZERO_ADDRESS;
  const showLoading = statusVisible && (isDeploying || adaptersLoading);
  const showBackButton = stepIndex > 0;
  const renderCta = () => {
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

    return (
      <Button
        variant="cta"
        size="sm"
        className="min-w-[170px]"
        isDisabled={!canFinalize || isFinalizing}
        onPress={() => void handleFinalize()}
      >
        {isFinalizing ? (
          <span className="flex items-center gap-2">
            <Spinner size={12} /> Finalizing...
          </span>
        ) : (
          'Finalize setup'
        )}
      </Button>
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
        <ModalHeader className="flex-col items-start gap-2">
          <div>
            <h2 className="text-2xl font-normal">{stepTitle}</h2>
            <p className="mt-1 text-sm text-secondary">Initialize this vault once before configuring strategies.</p>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-6 px-2">
          {currentStep === 'deploy' && (
            <DeployAdapterStep
              loading={showLoading}
              adapterDetected={adapterDetected}
              adapterAddress={unifiedAdapter}
            />
          )}
          {currentStep === 'finalize' && (
            <FinalizeSetupStep
              adapter={unifiedAdapter}
              registryAddress={registryAddress}
              isFinalizing={isFinalizing}
            />
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

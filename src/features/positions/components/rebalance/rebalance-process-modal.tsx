import { useMemo } from 'react';
import { LuArrowRightLeft } from 'react-icons/lu';

import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { RebalanceStepType } from '@/hooks/useRebalance';

type RebalanceProcessModalProps = {
  currentStep: RebalanceStepType;
  isPermit2Flow: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  actionsCount: number;
};

export function RebalanceProcessModal({
  currentStep,
  isPermit2Flow,
  isOpen,
  onOpenChange,
  tokenSymbol,
  actionsCount,
}: RebalanceProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    const permit2Steps = [
      {
        key: 'approve_permit2',
        label: 'Authorize Permit2',
        detail: 'Approve the Permit2 contract if this is your first time using it.',
      },
      {
        key: 'authorize_bundler_sig',
        label: 'Authorize Morpho Bundler (Signature)',
        detail: 'Sign a message to authorize the Morpho bundler if needed.',
      },
      {
        key: 'sign_permit',
        label: 'Sign Token Permit',
        detail: 'Sign a Permit2 signature to authorize the token transfer.',
      },
      {
        key: 'execute',
        label: 'Confirm Rebalance',
        detail: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${actionsCount > 1 ? 's' : ''}.`,
      },
    ];

    const standardSteps = [
      {
        key: 'authorize_bundler_tx',
        label: 'Authorize Morpho Bundler (Transaction)',
        detail: 'Submit a transaction to authorize the Morpho bundler if needed.',
      },
      {
        key: 'approve_token',
        label: `Approve ${tokenSymbol}`,
        detail: `Approve the bundler contract to spend your ${tokenSymbol}.`,
      },
      {
        key: 'execute',
        label: 'Confirm Rebalance',
        detail: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${actionsCount > 1 ? 's' : ''}.`,
      },
    ];

    return isPermit2Flow ? permit2Steps : standardSteps;
  }, [isPermit2Flow, actionsCount, tokenSymbol]);

  // Handle 'idle' step specially - treat it as first step
  const effectiveCurrentStep = currentStep === 'idle' ? steps[0].key : currentStep;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`Rebalancing ${tokenSymbol} Positions`}
        description={`Executing ${actionsCount} action${actionsCount === 1 ? '' : 's'} in this batch`}
        mainIcon={<LuArrowRightLeft className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="gap-5">
        <ProcessStepList
          steps={steps}
          currentStep={effectiveCurrentStep}
        />
      </ModalBody>
    </Modal>
  );
}

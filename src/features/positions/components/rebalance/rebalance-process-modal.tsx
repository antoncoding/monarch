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
        id: 'approve_permit2',
        title: 'Authorize Permit2',
        description: 'Approve the Permit2 contract if this is your first time using it.',
      },
      {
        id: 'authorize_bundler_sig',
        title: 'Authorize Morpho Bundler (Signature)',
        description: 'Sign a message to authorize the Morpho bundler if needed.',
      },
      {
        id: 'sign_permit',
        title: 'Sign Token Permit',
        description: 'Sign a Permit2 signature to authorize the token transfer.',
      },
      {
        id: 'execute',
        title: 'Confirm Rebalance',
        description: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${actionsCount > 1 ? 's' : ''}.`,
      },
    ];

    const standardSteps = [
      {
        id: 'authorize_bundler_tx',
        title: 'Authorize Morpho Bundler (Transaction)',
        description: 'Submit a transaction to authorize the Morpho bundler if needed.',
      },
      {
        id: 'approve_token',
        title: `Approve ${tokenSymbol}`,
        description: `Approve the bundler contract to spend your ${tokenSymbol}.`,
      },
      {
        id: 'execute',
        title: 'Confirm Rebalance',
        description: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${actionsCount > 1 ? 's' : ''}.`,
      },
    ];

    return isPermit2Flow ? permit2Steps : standardSteps;
  }, [isPermit2Flow, actionsCount, tokenSymbol]);

  // Handle 'idle' step specially - treat it as first step
  const effectiveCurrentStep = currentStep === 'idle' ? steps[0].id : currentStep;

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

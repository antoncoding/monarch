import React from 'react';
import { FaCheckCircle, FaCircle, FaRobot } from 'react-icons/fa';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { AuthorizeAgentStep } from '@/hooks/useAuthorizeAgent';

type AgentSetupModalProps = {
  currentStep: AuthorizeAgentStep;
  onClose: () => void;
};

const steps = [
  {
    key: AuthorizeAgentStep.Authorize,
    label: 'Authorize Monarch Agent',
    detail:
      'Sign a signature to authorize the Monarch Agent contract to reallocate your positions.',
  },
  {
    key: AuthorizeAgentStep.Execute,
    label: 'Execute Transaction',
    detail: 'Confirm transaction in wallet to complete the setup',
  },
];

export function AgentSetupProcessModal({
  currentStep,
  onClose,
}: AgentSetupModalProps): JSX.Element {
  const getStepStatus = (stepKey: string) => {
    const currentIndex = steps.findIndex((step) => step.key === currentStep);
    const stepIndex = steps.findIndex((step) => step.key === stepKey);

    if (stepIndex < currentIndex) {
      return 'done';
    }
    if (stepKey === currentStep) {
      return 'current';
    }
    return 'undone';
  };

  return (
    <Modal isOpen onClose={onClose} size="lg" isDismissable={false} backdrop="blur">
      <ModalHeader
        title="Setup Monarch Agent"
        description="Authorize the agent once to enable automated rebalances"
        mainIcon={<FaRobot className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-4">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 rounded border p-3 transition-colors ${
                status === 'current'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              <div className="mt-0.5">
                {status === 'done' ? (
                  <FaCheckCircle className="h-5 w-5 text-green-500" />
                ) : status === 'current' ? (
                  <FaCircle className="h-5 w-5 animate-pulse text-primary" />
                ) : (
                  <FaCircle className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div>
                <div className="font-medium">{step.label}</div>
                <div className="text-sm text-gray-500">{step.detail}</div>
              </div>
            </div>
          );
        })}
      </ModalBody>
    </Modal>
  );
}

import { FaCheckCircle, FaCircle } from 'react-icons/fa';

export type ProcessStep = {
  key: string;
  label: string;
  detail: string;
};

export type StepStatus = 'done' | 'current' | 'undone';

type ProcessStepListProps = {
  steps: ProcessStep[];
  currentStep: string;
};

function StepIcon({ status }: { status: StepStatus }): JSX.Element {
  switch (status) {
    case 'done':
      return <FaCheckCircle className="h-5 w-5 text-green-500" />;
    case 'current':
      return <FaCircle className="h-5 w-5 animate-pulse text-primary" />;
    default:
      return <FaCircle className="h-5 w-5 text-gray-300 dark:text-gray-600" />;
  }
}

/**
 * Shared step list component for process modals.
 * Displays transaction progress with consistent styling across all process modals.
 */
export function ProcessStepList({ steps, currentStep }: ProcessStepListProps): JSX.Element {
  const currentIndex = steps.findIndex((step) => step.key === currentStep);

  const getStepStatus = (stepIndex: number): StepStatus => {
    if (stepIndex < currentIndex) return 'done';
    if (stepIndex === currentIndex) return 'current';
    return 'undone';
  };

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        return (
          <div
            key={step.key}
            className={`flex items-start gap-3 rounded border p-3 transition-colors ${
              status === 'current' ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-gray-700'
            }`}
          >
            <div className="mt-0.5">
              <StepIcon status={status} />
            </div>
            <div>
              <div className="font-medium">{step.label}</div>
              <div className="text-sm text-gray-500">{step.detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

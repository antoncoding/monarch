import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { cn } from '@/utils';

export type ProcessStep = {
  id: string;
  title: string;
  description: string;
};

export type StepStatus = 'done' | 'current' | 'undone';

type ProcessStepListProps = {
  steps: ProcessStep[];
  currentStep: string;
};

function StepIcon({ status }: { status: StepStatus }): JSX.Element {
  const renderIcon = () => {
    switch (status) {
      case 'done':
        return <FaCheckCircle className="h-5 w-5 text-primary" />;
      case 'current':
        return (
          <div className="relative flex items-center justify-center">
            <FaCircle className="h-4 w-4 text-primary" />
            <div className="absolute h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        );
      default:
        return <FaCircle className="h-5 w-5 text-gray-300 dark:text-gray-600" />;
    }
  };

  return <div className={cn('mt-0.5 transition-all duration-300', status === 'current' && 'scale-110')}>{renderIcon()}</div>;
}

/**
 * Shared step list component for process modals.
 * Displays transaction progress with animated focus transitions.
 */
export function ProcessStepList({ steps, currentStep }: ProcessStepListProps): JSX.Element {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  const getStepStatus = (stepIndex: number): StepStatus => {
    if (stepIndex < currentIndex) return 'done';
    if (stepIndex === currentIndex) return 'current';
    return 'undone';
  };

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const status = getStepStatus(index);

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-start gap-3 rounded border p-3',
              'transition-all duration-300 ease-out',
              status === 'current' && ['border-primary bg-primary/5', 'scale-[1.02] shadow-sm shadow-primary/10'],
              status === 'done' && 'border-border opacity-70',
              status === 'undone' && 'border-border opacity-40',
            )}
          >
            <StepIcon status={status} />
            <div className={cn('transition-opacity duration-300', status === 'undone' && 'opacity-60')}>
              <div className="font-medium">{step.title}</div>
              <div className="text-sm text-secondary">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

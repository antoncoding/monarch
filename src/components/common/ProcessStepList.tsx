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
  return (
    <div className={cn('mt-0.5 transition-all duration-300', status === 'current' && 'scale-110')}>
      {status === 'done' && <FaCheckCircle className="h-5 w-5 text-green-500" />}
      {status === 'current' && (
        <div className="relative">
          <FaCircle className="h-5 w-5 text-primary" />
          <div className="absolute inset-0 animate-ping opacity-30">
            <FaCircle className="h-5 w-5 text-primary" />
          </div>
        </div>
      )}
      {status === 'undone' && <FaCircle className="h-5 w-5 text-gray-300 dark:text-gray-600" />}
    </div>
  );
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
        const isCurrent = status === 'current';
        const isDone = status === 'done';
        const isUndone = status === 'undone';

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3',
              'transition-all duration-300 ease-out',
              isCurrent && ['border-primary bg-primary/5', 'scale-[1.02] shadow-sm shadow-primary/10'],
              isDone && ['border-green-200 dark:border-green-900/50', 'opacity-70'],
              isUndone && ['border-gray-100 dark:border-gray-800', 'opacity-40'],
            )}
          >
            <StepIcon status={status} />
            <div className={cn('transition-opacity duration-300', isUndone && 'opacity-60')}>
              <div className="font-medium">{step.title}</div>
              <div className="text-sm text-secondary">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

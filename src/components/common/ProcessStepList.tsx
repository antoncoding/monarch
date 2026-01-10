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
        return <FaCheckCircle className="h-4 w-4 text-foreground/60" />;
      case 'current':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />;
      default:
        return <FaCircle className="h-2 w-2 text-foreground/30" />;
    }
  };

  return <div className="flex h-5 w-5 items-center justify-center">{renderIcon()}</div>;
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
    <div className="space-y-2">
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const isCurrent = status === 'current';

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 transition-all duration-300 ease-out',
              isCurrent && 'border-foreground/20 bg-foreground/5',
              status === 'done' && 'border-foreground/10 opacity-70',
              status === 'undone' && 'border-foreground/5 opacity-40',
            )}
          >
            <StepIcon status={status} />
            <div className="min-w-0 flex-1">
              <div className="text-sm">{step.title}</div>
              {isCurrent && <div className="mt-0.5 text-sm text-secondary">{step.description}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

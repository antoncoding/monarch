import { FaCheckCircle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { useOnboarding } from './onboarding-context';

export function SuccessPage({ onClose }: { onClose: () => void }) {
  const { selectedToken, resetOnboarding } = useOnboarding();

  const handleFinished = () => {
    onClose();
    resetOnboarding();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <FaCheckCircle className="h-12 w-12 text-green-500" />
          <h1 className="text-2xl font-bold">Success!</h1>
        </div>
        <p className="max-w-md text-gray-600 dark:text-gray-300">Your {selectedToken?.symbol} has been successfully supplied to Morpho.</p>
      </div>

      <div className="mt-4">
        <Button
          variant="primary"
          className="min-w-[120px]"
          onClick={handleFinished}
        >
          Close
        </Button>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { Button } from '@/components/common/Button';
import { SupportedNetworks } from '@/utils/networks';
import { useOnboarding } from './OnboardingContext';

export function SuccessPage({
  onClose,
  goToAgentSetup,
}: {
  onClose: () => void;
  goToAgentSetup: () => void;
}) {
  const { selectedToken, resetOnboarding } = useOnboarding();

  const allowAgentSetting = useMemo(() => {
    return selectedToken?.network === SupportedNetworks.Base;
  }, [selectedToken?.network]);

  const handleFinished = () => {
    onClose();
    resetOnboarding();
  };

  const handleGoToAgent = () => {
    onClose();
    resetOnboarding();
    goToAgentSetup();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <FaCheckCircle className="h-12 w-12 text-green-500" />
          <h1 className="text-2xl font-bold">Success!</h1>
        </div>
        <p className="max-w-md text-gray-600 dark:text-gray-300">
          Your {selectedToken?.symbol} has been successfully supplied to Morpho.{' '}
          {allowAgentSetting && 'You can set Monarch Agent to automate reallocate your positions.'}
        </p>
      </div>

      <div className="mt-4 flex gap-4">
        <Button variant="secondary" className="min-w-[120px]" onPress={handleFinished}>
          Close
        </Button>
        {allowAgentSetting && (
          <Button variant="cta" className="min-w-[120px]" onPress={handleGoToAgent}>
            Set Monarch Agent
          </Button>
        )}
      </div>
    </div>
  );
}

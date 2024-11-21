import Link from 'next/link';
import { Button } from '@nextui-org/react';
import { FaCheckCircle } from 'react-icons/fa';
import { useOnboarding } from './OnboardingContext';

export function SuccessPage() {
  const { selectedToken } = useOnboarding();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <FaCheckCircle className="h-16 w-16 text-green-500" />
          <h1 className="text-4xl font-bold">Success!</h1>
        </div>
        <p className="max-w-md text-xl text-gray-600 dark:text-gray-300">
          Your {selectedToken?.symbol} has been successfully supplied to Morpho Blue.
        </p>
      </div>

      <div className="flex gap-4">
        <Link href={`/positions/${selectedToken?.address ?? ''}`} className="no-underline">
          <Button color="primary" className="min-w-[120px] rounded">
            View Position
          </Button>
        </Link>
        <Link href="/positions/onboarding" className="no-underline border-1 bg-surface">
          <Button variant="light" className="min-w-[120px] rounded">
            Supply More
          </Button>
        </Link>
      </div>
    </div>
  );
}

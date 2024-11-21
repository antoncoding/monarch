import Link from 'next/link';
import { useOnboarding } from './OnboardingContext';

export function SuccessPage() {
  const { selectedToken } = useOnboarding();

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold text-green-500">Success!</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Your {selectedToken?.symbol} has been successfully supplied.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href={`/positions/${selectedToken?.address ?? ''}`}
          className="bg-monarch-orange hover:bg-monarch-orange/90 rounded px-6 py-2 font-semibold text-white transition-all"
        >
          View Position
        </Link>
        <Link
          href="/markets"
          className="rounded bg-gray-200 px-6 py-2 font-semibold text-gray-700 transition-all hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Explore Markets
        </Link>
      </div>
    </div>
  );
}

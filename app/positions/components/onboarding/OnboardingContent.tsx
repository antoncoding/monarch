'use client';

import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/header/Header';
import { AssetSelection } from './AssetSelection';
import { OnboardingProvider } from './OnboardingContext';
import { RiskSelection } from './RiskSelection';
import { SetupPositions } from './SetupPositions';
import { SuccessPage } from './SuccessPage';

export function OnboardingContent() {
  const searchParams = useSearchParams();
  const step = searchParams.get('step') ?? 'asset-selection';

  const renderStep = () => {
    switch (step) {
      case 'asset-selection':
        return <AssetSelection />;
      case 'risk-selection':
        return <RiskSelection />;
      case 'setup':
        return <SetupPositions />;
      case 'success':
        return <SuccessPage />;
      default:
        return <AssetSelection />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col font-zen">
      <Header />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8">
        <OnboardingProvider>
          <div className="flex min-h-0 flex-1 flex-col">{renderStep()}</div>
        </OnboardingProvider>
      </div>
    </div>
  );
}

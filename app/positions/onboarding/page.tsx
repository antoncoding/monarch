'use client';

import { useSearchParams } from 'next/navigation';
import { OnboardingProvider } from '../components/onboarding/OnboardingContext';
import { AssetSelection } from '../components/onboarding/AssetSelection';
import { RiskSelection } from '../components/onboarding/RiskSelection';
import { SetupPositions } from '../components/onboarding/SetupPositions';
import Header from '@/components/layout/header/Header';

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const step = searchParams.get('step') || 'asset-selection';

  const renderStep = () => {
    switch (step) {
      case 'asset-selection':
        return <AssetSelection />;
      case 'risk-selection':
        return <RiskSelection />;
      case 'setup':
        return <SetupPositions />;
      default:
        return <AssetSelection />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col font-zen">
      <Header />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 flex flex-col">
        <OnboardingProvider>
          <div className="flex-1 flex flex-col min-h-0">
            {renderStep()}
          </div>
        </OnboardingProvider>
      </div>
    </div>
  );
}

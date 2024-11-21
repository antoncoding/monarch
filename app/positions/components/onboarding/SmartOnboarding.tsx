import { AssetSelection } from './AssetSelection';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import { RiskSelection } from './RiskSelection';

function OnboardingContent() {
  const { step } = useOnboarding();

  return (
    <div className="w-full">
      {step === 'asset-selection' && <AssetSelection />}
      {step === 'risk-selection' && <RiskSelection />}
    </div>
  );
}

export function SmartOnboarding() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}

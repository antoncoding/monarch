import { AssetSelection } from './onboarding/AssetSelection';
import { RiskSelection } from './onboarding/RiskSelection';
import { OnboardingProvider } from './onboarding/OnboardingContext';

export function SmartOnboarding() {
  return (
    <div className="mx-auto max-w-7xl">
      <OnboardingProvider>
        <AssetSelection />
        <RiskSelection />
      </OnboardingProvider>
    </div>
  );
}

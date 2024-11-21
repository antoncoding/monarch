import { AssetSelection } from './onboarding/AssetSelection';
import { OnboardingProvider } from './onboarding/OnboardingContext';
import { RiskSelection } from './onboarding/RiskSelection';

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

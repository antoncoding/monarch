import { Metadata } from 'next';
import OnboardingContent from '../components/onboarding/content';

export const metadata: Metadata = {
  title: 'New Position | Monarch',
  description: 'Create a new position on Morpho Blue',
};

export default function OnboardingPage() {
  return (<OnboardingContent/>)

}

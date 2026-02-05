import { generateMetadata } from '@/utils/generateMetadata';
import RewardsLandingView from '@/features/rewards/rewards-landing-view';

export const metadata = generateMetadata({
  title: 'Rewards | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function LogIn() {
  return <RewardsLandingView />;
}

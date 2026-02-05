import { generateMetadata } from '@/utils/generateMetadata';
import PositionsLandingView from '@/features/positions/positions-landing-view';

export const metadata = generateMetadata({
  title: 'Portfolio | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function LogIn() {
  return <PositionsLandingView />;
}

import { generateMetadata } from '@/utils/generateMetadata';
import PortfoliosLandingView from '@/features/portfolios/portfolios-landing-view';

export const metadata = generateMetadata({
  title: 'Portfolios | Monarch',
  description: 'View multiple accounts in one local portfolio',
  images: 'themes.png',
  pathname: '/portfolios',
});

export default function PortfoliosPage() {
  return <PortfoliosLandingView />;
}

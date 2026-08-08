import PortfolioView from '@/features/portfolios/portfolio-view';
import { generateMetadata } from '@/utils/generateMetadata';

export const metadata = generateMetadata({
  title: 'Portfolio | Monarch',
  description: 'View multiple accounts in one local portfolio',
  images: 'themes.png',
  pathname: '/portfolios',
});

export default function PortfolioPage() {
  return <PortfolioView />;
}

import { generateMetadata } from '@/utils/generateMetadata';

import MarketContent from './components/markets';

export const metadata = generateMetadata({
  title: 'Markets',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function MarketPage() {
  return <MarketContent />;
}

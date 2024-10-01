import { generateMetadata } from '@/utils/generateMetadata';

import InfoContent from './components/info';

export const metadata = generateMetadata({
  title: 'Info | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function MarketPage() {
  return <InfoContent />;
}

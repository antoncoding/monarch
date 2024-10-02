import { generateMetadata } from '@/utils/generateMetadata';

import Content from '../components/PositionsContent';

export const metadata = generateMetadata({
  title: 'Positions | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function MarketPage() {
  return <Content />;
}

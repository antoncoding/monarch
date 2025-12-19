import { generateMetadata } from '@/utils/generateMetadata';

import Content from '@/features/positions/positions-view';

export const metadata = generateMetadata({
  title: 'Portfolio | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function PositionPage() {
  return <Content />;
}

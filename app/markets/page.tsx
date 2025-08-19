import { Suspense } from 'react';
import { generateMetadata } from '@/utils/generateMetadata';

import MarketContent from './components/markets';

export const metadata = generateMetadata({
  title: 'Markets | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function MarketPage() {
  return (
    <Suspense fallback={<div>Loading markets...</div>}>
      <MarketContent />
    </Suspense>
  );
}

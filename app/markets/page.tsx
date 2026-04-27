import { generateMetadata } from '@/utils/generateMetadata';
import MarketContent from '@/features/markets/markets-view';

export const dynamic = 'force-static';

export const metadata = generateMetadata({
  title: 'Markets | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function MarketPage() {
  return <MarketContent />;
}

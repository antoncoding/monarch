import { Metadata } from 'next';
import MarketContent from './content';

export const metadata: Metadata = {
  title: 'Market Details | Morpho Blue',
  description: 'Detailed information about a specific market on Morpho Blue',
};

export default function MarketPage() {
  return <MarketContent />;
}

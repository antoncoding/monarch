import type { Metadata } from 'next';
import MarketContent from '../../../../src/features/market-detail/market-view';

export const metadata: Metadata = {
  title: 'Market Details | Morpho Blue',
  description: 'Detailed information about a specific market on Morpho Blue',
};

export default function MarketPage() {
  return <MarketContent />;
}

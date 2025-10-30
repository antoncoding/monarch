import { generateMetadata } from '@/utils/generateMetadata';
import RiskContent from './RiskContent';

export const metadata = generateMetadata({
  title: 'Risks | Monarch',
  description: 'Understanding the risks of Monarch',
  images: 'themes.png',
  pathname: '',
});

export default function RiskPage() {
  return <RiskContent />;
}

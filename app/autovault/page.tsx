import { generateMetadata } from '@/utils/generateMetadata';

import AutovaultContent from './components/AutovaultContent';

export const metadata = generateMetadata({
  title: 'Autovault | Monarch',
  description: 'Automated vault management with intelligent agents',
  images: 'themes.png',
  pathname: '',
});

export default function AutovaultPage() {
  return <AutovaultContent />;
}

import { generateMetadata } from '@/utils/generateMetadata';

import Content from '../components/RewardContent';

export const metadata = generateMetadata({
  title: 'Rewards',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function RewardPage() {
  return <Content />;
}

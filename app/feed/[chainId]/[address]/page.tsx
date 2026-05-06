import { generateMetadata } from '@/utils/generateMetadata';
import FeedContent from '@/features/feed-detail/feed-view';

export const dynamic = 'force-dynamic';

export const metadata = generateMetadata({
  title: 'Feed Details | Monarch',
  description: 'Oracle feed dependency details and market exposure on Monarch.',
  images: 'themes.png',
  pathname: '',
});

export default function FeedPage() {
  return <FeedContent />;
}

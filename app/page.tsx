import { generateMetadata } from '@/utils/generateMetadata';
import HomePage from '../src/features/home/home-view';

export const metadata = generateMetadata({
  title: 'Monarch',
  description: 'Customized lending on Morpho Blue with no intermediaries',
  images: 'themes.png',
  pathname: '',
});

/**
 * Server component, which imports the HomePage component (client component that has 'use client' in it)
 * https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts
 * https://nextjs.org/docs/pages/building-your-application/upgrading/app-router-migration#step-4-migrating-pages
 * https://nextjs.org/docs/app/building-your-application/rendering/client-components
 */
export default function Page() {
  return <HomePage />;
}

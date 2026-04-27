import { generateMetadata } from '@/utils/generateMetadata';
import { serializeSearchParamsRecord, type SearchParamsRecord } from '@/utils/search-params';
import { redirect } from 'next/navigation';
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
const MARKET_INTENT_QUERY_KEYS = new Set(['network', 'chain', 'ref', 'loan', 'collateral']);

type HomePageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function Page({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const hasMarketIntent = Object.keys(resolvedSearchParams).some((key) => MARKET_INTENT_QUERY_KEYS.has(key));

  if (hasMarketIntent) {
    const nextSearchParams = serializeSearchParamsRecord(resolvedSearchParams);
    redirect(nextSearchParams ? `/markets?${nextSearchParams}` : '/markets');
  }

  return <HomePage />;
}

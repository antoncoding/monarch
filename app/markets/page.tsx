import { generateMetadata } from '@/utils/generateMetadata';
import MarketContent from '@/features/markets/markets-view';
import { serializeSearchParamsRecord, type SearchParamsRecord } from '@/utils/search-params';

export const metadata = generateMetadata({
  title: 'Markets | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

type MarketPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function MarketPage({ searchParams }: MarketPageProps) {
  const resolvedSearchParams = await searchParams;
  return <MarketContent initialSearchParams={serializeSearchParamsRecord(resolvedSearchParams)} />;
}

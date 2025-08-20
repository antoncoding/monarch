import { generateMetadata } from '@/utils/generateMetadata';
import { SupportedNetworks } from '@/utils/networks';
import MarketContent from './components/markets';

export const metadata = generateMetadata({
  title: 'Markets | Monarch',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

type PageProps = {
  searchParams: Promise<{
    network?: string;
    collaterals?: string;
    loanAssets?: string;
    [key: string]: string | string[] | undefined;
  }>;
}

export default async function MarketPage({ searchParams }: PageProps) {
  // Await the searchParams Promise in Next.js 15
  const params = await searchParams;
  
  // Parse and validate parameters server-side
  const networkParam = params.network;
  const defaultNetwork = (() => {
    return networkParam &&
      Object.values(SupportedNetworks).includes(Number(networkParam) as SupportedNetworks)
      ? (Number(networkParam) as SupportedNetworks)
      : null;
  })();

  const collaterals = params.collaterals 
    ? params.collaterals.split(',').filter(Boolean) 
    : [];
    
  const loanAssets = params.loanAssets 
    ? params.loanAssets.split(',').filter(Boolean) 
    : [];

  // Pass parsed params to client component
  return (
    <MarketContent 
      initialNetwork={defaultNetwork}
      initialCollaterals={collaterals}
      initialLoanAssets={loanAssets}
    />
  );
}

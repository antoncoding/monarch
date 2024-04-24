'use client';
import Header from '@/components/layout/header/Header';
import useMarkets from '@/hooks/useMarkets';

/**
 * Use the page component to wrap the components
 * that you want to render on the page.
 */
export default function HomePage() {

  const {loading, data} = useMarkets()

  console.log('data', data, loading)

  return (
    <div className="flex flex-col justify-between">
        <Header />
        <div className='container'>
          <h1> Browse </h1>
        </div>
      
    </div>
  );
}

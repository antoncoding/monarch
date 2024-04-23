'use client';
import Footer from '@/components/layout/footer/Footer';
import HomeHeader from './_components/HomeHeader';

/**
 * Use the page component to wrap the components
 * that you want to render on the page.
 */
export default function HomePage() {
  return (
    <div className='flex flex-col h-screen justify-between'>
    <div>
        <HomeHeader />
        <main className="container mx-auto flex flex-col px-8 py-16">
          <section className="mb-12 flex flex-col items-center justify-center">
            <div className="w-full md:w-4/5">
              <h2 className="mb-10 text-center text-xl font-medium text-white md:text-2xl lg:text-3xl">
                Access the most decentralized lending protocol on Ethereum
              </h2>
            </div>
          </section>
        </main>
      </div>
      <Footer />
      </div>
  );
}

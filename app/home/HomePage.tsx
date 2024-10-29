'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import PrimaryButton from '@/components/common/PrimaryButton';
import Footer from '@/components/layout/footer/Footer';
import HomeHeader from './_components/HomeHeader';

export default function HomePage() {
  const [isMorphoBlue, setIsMorphoBlue] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsMorphoBlue((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const { address } = useAccount();

  return (
    <div className="bg-main flex min-h-screen flex-col">
      <div className="flex flex-col items-center justify-center">
        <HomeHeader />
        <main className="container flex flex-col">
          <section className="mt-4 flex flex-col items-center justify-center sm:mt-8">
            <div className="h-40 w-full sm:h-32 sm:w-4/5 md:w-3/5">
              {' '}
              {/* Fixed height container */}
              <h2 className="mb-2 px-4 text-center font-zen text-3xl leading-tight text-primary sm:mb-10 sm:text-4xl md:text-5xl">
                <span className="block sm:inline">Direct access to</span>{' '}
                <span
                  className={`block transition-all duration-1000 sm:inline ${
                    isMorphoBlue ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  {isMorphoBlue ? '{Morpho Blue}' : 'the most decentralized lending protocol.'}
                </span>
              </h2>
            </div>
          </section>
        </main>
        <div className="flex w-full flex-col items-center justify-center gap-4 px-4 pb-12 pt-4 sm:w-4/5 sm:flex-row">
          <PrimaryButton isSecondary href="/info" className="w-full sm:w-auto">
            Why Monarch
          </PrimaryButton>
          <PrimaryButton href={`/positions/${address ?? ''}`} className="w-full sm:w-auto">
            View Portfolio
          </PrimaryButton>
        </div>
      </div>
      <Footer />
    </div>
  );
}

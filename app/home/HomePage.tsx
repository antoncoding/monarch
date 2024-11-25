'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import PrimaryButton from '@/components/common/PrimaryButton';
import Footer from '@/components/layout/footer/Footer';
import HomeHeader from './_components/HomeHeader';

export default function HomePage() {
  const [counter, setCounter] = useState(0);

  const firstPhrases = ['Customized lending', 'Manage your own yield', 'Control your risk'];
  const secondPhrases = ['on Morpho Blue', 'with no intermediates'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(prev => (prev + 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Get current phrases based on counter
  const currentFirstIndex = Math.floor(counter / 2) % firstPhrases.length;
  const nextFirstIndex = (currentFirstIndex + 1) % firstPhrases.length;
  const currentSecondIndex = Math.floor((counter + 3) / 2) % secondPhrases.length;
  const nextSecondIndex = (currentSecondIndex + 1) % secondPhrases.length;

  // Determine which section is changing
  const isFirstChanging = counter % 2 === 0;

  const { address } = useAccount();

  return (
    <div className="bg-main flex min-h-screen flex-col">
      <div className="flex flex-col items-center justify-center">
        <HomeHeader />
        <main className="container flex flex-col">
          <section className="mt-4 flex flex-col items-center justify-center sm:mt-8">
            <div className="h-52 w-full sm:h-44 sm:w-4/5 md:w-3/5">
              <h2 className="mb-2 flex flex-col gap-6 px-4 text-center font-zen text-3xl leading-tight text-primary sm:mb-10 sm:text-4xl md:text-5xl">
                <div className="h-[1.3em] relative">
                  <span
                    className={`absolute left-0 right-0 transform transition-all duration-700 ease-in-out ${
                      !isFirstChanging ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                    }`}
                  >
                    {firstPhrases[currentFirstIndex]}
                  </span>
                  <span
                    className={`absolute left-0 right-0 transform transition-all duration-700 ease-in-out ${
                      isFirstChanging ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                    }`}
                  >
                    {firstPhrases[nextFirstIndex]}
                  </span>
                </div>
                <div className="h-[1.3em] relative">
                  <span
                    className={`absolute left-0 right-0 transform transition-all duration-700 ease-in-out ${
                      isFirstChanging ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                    }`}
                  >
                    {secondPhrases[currentSecondIndex].includes('Morpho Blue') ? (
                      <span>
                        on <span className="text-blue-500">Morpho Blue</span>
                      </span>
                    ) : (
                      secondPhrases[currentSecondIndex]
                    )}
                  </span>
                  <span
                    className={`absolute left-0 right-0 transform transition-all duration-700 ease-in-out ${
                      !isFirstChanging ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                    }`}
                  >
                    {secondPhrases[nextSecondIndex].includes('Morpho Blue') ? (
                      <span>
                        on <span className="text-blue-500">Morpho Blue</span>
                      </span>
                    ) : (
                      secondPhrases[nextSecondIndex]
                    )}
                  </span>
                </div>
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

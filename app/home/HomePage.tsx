'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Footer from '@/components/layout/footer/Footer';
import backgroundImage from '@/imgs/bg/bg.png';
import HomeHeader from './_components/HomeHeader';

export default function HomePage() {
  const [isMorphoBlue, setIsMorphoBlue] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsMorphoBlue((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-primary">
      <div
        className="flex flex-col items-center justify-center"
        style={{
          backgroundImage: `url(${backgroundImage.src})`,
          // position: right and bottom
          backgroundPosition: 'right bottom',
          backgroundSize: 'original',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <HomeHeader />
        <main className="container flex flex-col">
          <section className="flex flex-col items-center justify-center">
            <div className="min-h-40 w-3/5">
              <h2 className="mb-10 px-4 font-zen text-2xl text-primary sm:px-2 md:text-2xl lg:text-3xl">
                Direct access to{' '}
                <span
                  className={`transition-all duration-1000 ${
                    isMorphoBlue ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  {isMorphoBlue ? '{Morpho Blue}' : 'the most decentralized lending protocol.'}
                </span>{' '}
              </h2>
            </div>
          </section>
        </main>
        <div className="flex h-3/4 w-4/5 items-center justify-center pb-12 pt-4 opacity-80">
          <Link href="/markets">
            <button
              type="button"
              className="bg-monarch-orange rounded-sm p-4 px-10 font-zen opacity-100 transition-all duration-200 ease-in-out hover:scale-105"
            >
              Start
            </button>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}

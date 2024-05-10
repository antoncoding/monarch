'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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

  return (
    <div className="flex h-screen flex-col justify-between">
      <div>
        <HomeHeader />
        <main className="container mx-auto flex flex-col">
          <section className="mb-12 flex flex-col items-center justify-center">
            <div className="w-full md:w-3/5">
              <h2 className="font-roboto mb-10 text-xl text-white md:text-2xl lg:text-3xl">
                Direct access to{' '}
                <span
                  className={`transition-all duration-1000 ${
                    isMorphoBlue ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  {isMorphoBlue ? '{ Morpho Blue }' : 'the most decentralized lending protocol.'}
                </span>{' '}
              </h2>
            </div>
          </section>
        </main>
        <div className="flex justify-center">
          <Link href="/markets">
            <button
              type="button"
              className="bg-monarch-orange font-roboto rounded-sm p-4 px-10 hover:opacity-80"
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

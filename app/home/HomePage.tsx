'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import Header from '@/components/layout/header/Header';

export default function HomePage() {
  const [showCustomized, setShowCustomized] = useState(true);
  const [riskYieldIndex, setRiskYieldIndex] = useState(0);
  const [secondCounter, setSecondCounter] = useState(0);

  const riskYieldTerms = ['risk', 'yield'];
  const secondPhrases = ['on Morpho Blue', 'with no intermediates'];

  useEffect(() => {
    // Toggle between customized and manage your own every 5 seconds
    const customizedInterval = setInterval(() => {
      setShowCustomized((prev) => !prev);
    }, 5000);

    // Change risk/yield every 3 seconds when showing manage your own
    const riskYieldInterval = setInterval(() => {
      if (!showCustomized) {
        setRiskYieldIndex((prev) => (prev + 1) % riskYieldTerms.length);
      }
    }, 3000);

    // Second segment changes every 4 seconds
    const secondInterval = setInterval(() => {
      setSecondCounter((prev) => (prev + 1) % secondPhrases.length);
    }, 4000);

    return () => {
      clearInterval(customizedInterval);
      clearInterval(riskYieldInterval);
      clearInterval(secondInterval);
    };
  }, [showCustomized]);

  const renderFirstPhrase = () => {
    if (showCustomized) {
      return (
        <span className="absolute inset-0 flex items-center justify-center text-primary transition-all duration-700 ease-in-out">
          Customized lending
        </span>
      );
    }
    return (
      <span className="absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out">
        <span className="-ml-8 inline-flex items-center text-primary">
          Manage your own
          <span className="relative mx-2 inline-flex items-center md:mx-4">
            {riskYieldTerms.map((term, index) => (
              <span
                key={term}
                className={`absolute left-0 text-monarch-primary transition-all duration-700 ease-in-out ${
                  index === riskYieldIndex
                    ? 'transform-none opacity-100'
                    : 'translate-y-3 transform opacity-0'
                }`}
              >
                {term}
              </span>
            ))}
          </span>
        </span>
      </span>
    );
  };

  const { address } = useAccount();

  return (
    <div className="bg-main flex min-h-screen flex-col">
      <Header ghost />
      <main className="container mx-auto flex flex-1 flex-col items-center justify-center">
        <section className="flex w-full flex-col items-center justify-center">
          <div className="h-48 w-full sm:h-44 sm:w-4/5 md:w-3/5">
            <h2 className="mb-2 flex flex-col gap-6 px-4 text-center font-zen text-3xl leading-tight text-secondary sm:mb-10 sm:text-4xl md:text-5xl">
              <div className="relative h-[1.3em]">{renderFirstPhrase()}</div>
              <div className="relative h-[1.3em]">
                {secondPhrases.map((phrase, index) => (
                  <span
                    key={phrase}
                    className={`absolute left-0 right-0 transform transition-all duration-700 ease-in-out ${
                      index === secondCounter
                        ? 'translate-y-0 opacity-100'
                        : index ===
                          (secondCounter - 1 + secondPhrases.length) % secondPhrases.length
                        ? 'translate-y-2 opacity-0'
                        : '-translate-y-2 opacity-0'
                    }`}
                  >
                    {phrase.includes('Morpho Blue') ? (
                      <span>
                        on <span className="text-blue-500">Morpho Blue</span>
                      </span>
                    ) : (
                      phrase
                    )}
                  </span>
                ))}
              </div>
            </h2>
          </div>
          <div className="mt-8 flex w-full justify-center gap-4 px-4 sm:w-auto sm:flex-row">
            <Link href="/info" className="block w-full sm:w-auto">
              <Button variant="default" className="w-full px-10 py-4 font-zen" size="lg">
                Learn More
              </Button>
            </Link>
            <Link href={`/positions/${address ?? ''}`} className="block w-full sm:w-auto">
              <Button variant="cta" className="w-full px-10 py-4 font-zen" size="lg">
                Launch App
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

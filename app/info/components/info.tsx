// eslint-disable jsx-a11y/click-events-have-key-events
// eslint-disable jsx-a11y/no-static-element-interactions
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Header from '@/components/layout/header/Header';
import { sections } from './sectionData';

function InfoPage() {
  const [currentSection, setCurrentSection] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const changeSection = (direction: 'next' | 'prev') => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSection((prev) => {
      if (direction === 'next') {
        return (prev + 1) % sections.length;
      } else {
        return (prev - 1 + sections.length) % sections.length;
      }
    });
    setTimeout(() => setIsTransitioning(false), 500);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextSection = () => changeSection('next');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevSection = () => changeSection('prev');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastScrollTime = 0;
    const scrollCooldown = 1000; // 1 second cooldown

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = new Date().getTime();
      if (now - lastScrollTime < scrollCooldown) return;

      if (e.deltaY > 0) {
        nextSection();
      } else {
        prevSection();
      }
      lastScrollTime = now;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        nextSection();
      } else if (e.key === 'ArrowUp') {
        prevSection();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nextSection, prevSection]);

  if (!isClient) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex min-h-screen flex-col font-zen" ref={containerRef}>
      <Header />
      <main className="flex flex-grow flex-col overflow-hidden pt-8">
        <div className="relative flex-grow overflow-hidden">
          <div
            className="absolute inset-0 flex flex-col transition-transform duration-500 ease-in-out"
            style={{ transform: `translateY(-${currentSection * 100}%)` }}
          >
            {sections.map((section) => (
              <div
                key={section.mainTitle}
                className="flex h-full w-full flex-shrink-0 flex-col items-center justify-start px-4 md:px-0"
              >
                <div className="w-full max-w-4xl">
                  <h1 className="mb-2 text-center text-4xl font-bold">{section.mainTitle}</h1>
                  <h2 className="mb-4 text-center text-xl text-secondary">{section.subTitle}</h2>
                  <div className="flex max-h-[calc(100vh-250px)] flex-col items-center gap-8 overflow-y-auto">
                    <div className="flex w-full items-center justify-center overflow-hidden rounded-lg">
                      <Image
                        src={section.image}
                        alt={section.mainTitle}
                        height={section.customHeight ? section.customHeight : 250}
                        objectFit="cover"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="w-full px-4 pb-8">{section.content}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <nav className="fixed bottom-8 left-1/2 flex -translate-x-1/2 transform space-x-2">
        {sections.map((_, index) => (
          <button
            type="button"
            key={index}
            className={`h-2 w-2 cursor-pointer rounded-full ${
              index === currentSection ? 'bg-monarch-orange' : 'bg-gray-300'
            }`}
            onClick={() => setCurrentSection(index)}
            aria-label={`Go to section ${index + 1}`}
          />
        ))}
      </nav>
    </div>
  );
}

export default InfoPage;

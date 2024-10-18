// eslint-disable jsx-a11y/click-events-have-key-events
// eslint-disable jsx-a11y/no-static-element-interactions
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Header from '@/components/layout/header/Header';
import { sections } from './sectionData';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Button } from '@nextui-org/react';

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

  const nextSection = () => changeSection('next');
  const prevSection = () => changeSection('prev');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastWheelTime = 0;
    const wheelThreshold = 50; // Minimum time between wheel events in ms

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime < wheelThreshold) return;
      
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        if (e.deltaX > 0) {
          nextSection();
        } else {
          prevSection();
        }
        lastWheelTime = now;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextSection();
      } else if (e.key === 'ArrowLeft') {
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
    <div className="min-h-screen font-zen bg-primary" ref={containerRef}>
      <Header />
      <main className="container relative mx-auto px-4 py-8">
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentSection * 100}%)` }}
          >
            {sections.map((section, index) => (
              <div
                key={section.mainTitle}
                className="w-full flex-shrink-0 px-4 md:px-8 lg:px-16"
              >
                <div className="rounded-lg bg-secondary px-4 sm:px-8 md:px-12 py-6 sm:py-8 shadow-lg max-w-3xl mx-auto">
                  <h1 className="mb-2 text-center text-3xl sm:text-4xl font-bold">{section.mainTitle}</h1>
                  <h2 className="mb-4 sm:mb-6 text-center text-lg sm:text-xl text-secondary">{section.subTitle}</h2>
                  <div className="flex flex-col items-center gap-4 sm:gap-8">
                    {index === sections.length - 1 ? (
                      // Special case for the logo in the last section
                      <div className="w-32 h-32 sm:w-48 sm:h-48 flex items-center justify-center rounded-lg p-2 sm:p-4">
                        <Image
                          src={section.image}
                          alt={section.mainTitle}
                          width={128}
                          height={128}
                          objectFit="contain"
                          className="rounded-lg"
                        />
                      </div>
                    ) : (
                      // For all other sections
                      <div className="flex h-48 sm:h-64 w-full items-center justify-center overflow-hidden rounded-lg">
                        <Image
                          src={section.image}
                          alt={section.mainTitle}
                          width={800}
                          height={256}
                          objectFit="contain"
                          className="rounded-lg"
                        />
                      </div>
                    )}
                    <div className="w-full prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert">
                      {section.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none fixed inset-0 flex items-center justify-between px-4 sm:px-12 md:px-24 lg:px-32">
          <Button
            isIconOnly
            color="primary"
            variant="flat"
            onPress={prevSection}
            className="pointer-events-auto"
            aria-label="Previous section"
          >
            <FaChevronLeft />
          </Button>
          <Button
            isIconOnly
            color="primary"
            variant="flat"
            onPress={nextSection}
            className="pointer-events-auto"
            aria-label="Next section"
          >
            <FaChevronRight />
          </Button>
        </div>
        <nav className="pointer-events-none fixed inset-x-0 bottom-8 flex justify-center space-x-2">
          {sections.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSection(index)}
              className={`w-3 h-3 rounded-full pointer-events-auto transition-colors duration-200 ease-in-out ${
                index === currentSection ? 'bg-monarch-orange' : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to section ${index + 1}`}
            />
          ))}
        </nav>
      </main>
    </div>
  );
}

export default InfoPage;

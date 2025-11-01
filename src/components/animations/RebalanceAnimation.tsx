'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

// Import token images
import usdcImg from '../../imgs/tokens/usdc.webp';
import cbBTCImg from '../../imgs/tokens/cbbtc.webp';
import cbETHImg from '../../imgs/tokens/cbeth.png';
import wstETHImg from '../../imgs/tokens/wsteth.webp';
import wethImg from '../../imgs/tokens/weth.webp';
import monarchLogo from '../../components/imgs/logo.png';

type Token = {
  name: string;
  image: any;
};

const tokens: Token[] = [
  { name: 'USDC', image: usdcImg },
  { name: 'cbBTC', image: cbBTCImg },
  { name: 'cbETH', image: cbETHImg },
  { name: 'wstETH', image: wstETHImg },
  { name: 'WETH', image: wethImg },
  { name: 'Monarch', image: monarchLogo },
];

type SlotState = {
  currentIndex: number;
  isSpinning: boolean;
  nextIndex: number;
};

function RebalanceAnimation() {
  const [slots, setSlots] = useState<SlotState[]>([
    { currentIndex: 0, isSpinning: false, nextIndex: 0 },
    { currentIndex: 1, isSpinning: false, nextIndex: 1 },
    { currentIndex: 2, isSpinning: false, nextIndex: 2 },
    { currentIndex: 3, isSpinning: false, nextIndex: 3 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly decide how many slots to change (1-3)
      const numSlotsToChange = Math.floor(Math.random() * 3) + 1;

      // Randomly select which slots to change
      const slotsToChange = new Set<number>();
      while (slotsToChange.size < numSlotsToChange) {
        slotsToChange.add(Math.floor(Math.random() * 3));
      }

      setSlots((prevSlots) =>
        prevSlots.map((slot, index) => {
          if (slotsToChange.has(index)) {
            // Pick a random next token
            const nextIndex = Math.floor(Math.random() * tokens.length);
            return {
              ...slot,
              isSpinning: true,
              nextIndex,
            };
          }
          return slot;
        })
      );

      // After animation duration, update the current index
      setTimeout(() => {
        setSlots((prevSlots) =>
          prevSlots.map((slot, index) => {
            if (slotsToChange.has(index)) {
              return {
                currentIndex: slot.nextIndex,
                isSpinning: false,
                nextIndex: slot.nextIndex,
              };
            }
            return slot;
          })
        );
      }, 500); // Match this with CSS transition duration
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 py-4 sm:gap-3">
      {slots.map((slot, index) => (
        <div
          key={index}
          className="relative h-12 w-12 overflow-hidden rounded-md bg-surface shadow-md sm:h-14 sm:w-14"
        >
          {/* Current token - slides up when spinning */}
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              slot.isSpinning ? 'transition-transform duration-500 ease-in-out -translate-y-full' : 'translate-y-0'
            }`}
          >
            <Image
              src={tokens[slot.currentIndex].image}
              alt={tokens[slot.currentIndex].name}
              width={40}
              height={40}
              className="h-8 w-8 object-contain sm:h-9 sm:w-9"
            />
          </div>
          {/* Next token - slides up from bottom when spinning */}
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              slot.isSpinning ? 'transition-transform duration-500 ease-in-out translate-y-0' : 'translate-y-full'
            }`}
          >
            <Image
              src={tokens[slot.nextIndex].image}
              alt={tokens[slot.nextIndex].name}
              width={40}
              height={40}
              className="h-8 w-8 object-contain sm:h-9 sm:w-9"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default RebalanceAnimation;

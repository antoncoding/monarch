import type { Variants, Transition } from 'framer-motion';

export type SlideDirection = 'forward' | 'backward';

export const slideVariants: Variants = {
  enter: (direction: SlideDirection) => ({
    x: direction === 'forward' ? '100%' : '-30%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: SlideDirection) => ({
    x: direction === 'forward' ? '-30%' : '100%',
    opacity: 0,
  }),
};

export const slideTransition: Transition = {
  duration: 0.15,
  ease: 'easeOut',
};

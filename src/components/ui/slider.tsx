import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/utils/components';

// Support both Radix and HeroUI API for backward compatibility
type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  // HeroUI compatibility props
  maxValue?: number;
  minValue?: number;
  isDisabled?: boolean;
  classNames?: {
    base?: string;
  };
};

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, maxValue, minValue, isDisabled, classNames, max, min, disabled, ...props }, ref) => {
    const effectiveMax = maxValue ?? max ?? 100;
    const effectiveMin = minValue ?? min ?? 0;
    const effectiveDisabled = isDisabled ?? disabled ?? false;

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn('relative flex w-full touch-none select-none items-center', className, classNames?.base)}
        max={effectiveMax}
        min={effectiveMin}
        disabled={effectiveDisabled}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-hovered">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-surface ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

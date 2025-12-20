import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/components';

const progressVariants = cva('relative w-full overflow-hidden rounded-full bg-hovered', {
  variants: {
    size: {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type ProgressRootProps = {
  label?: string;
  showValueLabel?: boolean;
  classNames?: {
    base?: string;
    label?: string;
    value?: string;
    track?: string;
    indicator?: string;
  };
};

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> &
  VariantProps<typeof progressVariants> &
  ProgressRootProps;

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  (allProps, ref) => {
    const { className, value = 0, size, label, showValueLabel, classNames, ...props } = allProps;
    const displayValue = Math.round(value ?? 0);

    if (label || showValueLabel) {
      return (
        <div className={cn('w-full', classNames?.base)}>
          {(label || showValueLabel) && (
            <div className="flex items-center justify-between mb-2">
              {label && <span className={cn('text-sm text-secondary font-zen', classNames?.label)}>{label}</span>}
              {showValueLabel && <span className={cn('text-sm text-primary font-zen', classNames?.value)}>{displayValue}%</span>}
            </div>
          )}
          <ProgressPrimitive.Root
            ref={ref}
            className={cn(progressVariants({ size }), className, classNames?.track)}
            value={value}
          >
            <ProgressPrimitive.Indicator
              className={cn('h-full w-full flex-1 bg-primary transition-all', classNames?.indicator)}
              style={{ transform: `translateX(-${100 - displayValue}%)` }}
            />
          </ProgressPrimitive.Root>
        </div>
      );
    }

    return (
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(progressVariants({ size }), className, classNames?.track)}
        value={value}
      >
        <ProgressPrimitive.Indicator
          className={cn('h-full w-full flex-1 bg-primary transition-all', classNames?.indicator)}
          style={{ transform: `translateX(-${100 - displayValue}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

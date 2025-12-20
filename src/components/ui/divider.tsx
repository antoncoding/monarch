import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/components';

const dividerVariants = cva('shrink-0 bg-border', {
  variants: {
    orientation: {
      horizontal: 'h-[1px] w-full',
      vertical: 'h-full w-[1px]',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

type DividerProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof dividerVariants>;

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <div ref={ref} className={cn(dividerVariants({ orientation }), className)} {...props} />
));
Divider.displayName = 'Divider';

export { Divider };

import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 ease-in-out border-0 outline-0 ring-0 focus:border-0 focus:outline-0 focus:ring-0 active:border-0 active:outline-0 active:ring-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 opacity-95 hover:opacity-100',
  {
    variants: {
      variant: {
        // For buttons on background areas
        default: 'bg-surface text-foreground hover:bg-surface/80 shadow-sm hover:shadow active:scale-[0.98]',

        // Primary action button
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow active:scale-[0.98]',

        // For buttons on surface-colored backgrounds (cards, modals, tables)
        surface: 'bg-hovered text-foreground hover:bg-hovered/80 active:scale-[0.98]',

        // For icon buttons and minimal actions (hover styles in compoundVariants below)
        ghost: 'bg-transparent text-foreground',
      },
      size: {
        xs: 'h-6 px-1.5 py-1 text-xs min-w-[40px]',
        sm: 'h-8 px-1.5 py-1 text-xs min-w-[64px]',
        md: 'h-10 px-4 py-2 text-sm min-w-[80px]',
        default: 'h-10 px-4 py-2 text-sm min-w-[80px]',
        lg: 'h-12 px-6 py-3 text-base min-w-[96px]',
        icon: 'h-8 w-8 [&_svg]:size-3.5 p-2',
      },
      radius: {
        none: 'rounded-none',
        base: 'rounded-sm',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
      isLoading: {
        true: 'cursor-not-allowed',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      radius: 'base',
      fullWidth: false,
      isLoading: false,
    },
    compoundVariants: [
      {
        isLoading: true,
        className: 'gap-2 [&>span]:opacity-0 [&>svg]:opacity-0 [&>*:not(.loading-spinner)]:opacity-0',
      },
      // Ghost button hover effects - darker backgrounds for better feedback
      {
        variant: 'ghost',
        size: 'icon',
        className: 'hover:bg-surface/70 active:bg-surface hover:scale-105 active:scale-100',
      },
      {
        variant: 'ghost',
        size: 'sm',
        className: 'hover:bg-surface/50 active:bg-surface/70 hover:scale-[1.02] active:scale-100',
      },
      {
        variant: 'ghost',
        size: 'md',
        className: 'hover:bg-default-100 active:bg-default-200 hover:scale-[1.01] active:scale-100',
      },
      {
        variant: 'ghost',
        size: 'lg',
        className: 'hover:bg-default-100 active:bg-default-200 hover:scale-[1.01] active:scale-100',
      },
    ],
  },
);

export type ButtonProps = {
  asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, fullWidth, isLoading, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, radius, fullWidth, isLoading, className }))}
        ref={ref}
        disabled={isLoading ? true : props.disabled}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

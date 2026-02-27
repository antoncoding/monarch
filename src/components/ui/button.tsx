import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/index';
import { Spinner } from './spinner';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 ease-in-out border-0 outline-0 ring-0 focus:border-0 focus:outline-0 focus:ring-0 active:border-0 active:outline-0 active:ring-0 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // For buttons on background areas
        default:
          'bg-surface text-foreground hover:bg-surface/70 hover:brightness-95 shadow-sm hover:shadow-md active:scale-[0.98] active:brightness-90',

        // Primary action button
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/85 hover:brightness-105 shadow-sm hover:shadow-md active:scale-[0.98] active:brightness-95',

        // For buttons on surface-colored backgrounds (cards, modals, tables)
        surface:
          'bg-hovered text-foreground hover:bg-default-200 hover:brightness-98 active:bg-default-300 active:scale-[0.98] active:brightness-95',

        // For icon buttons and minimal actions (hover styles in compoundVariants below)
        ghost: 'bg-transparent text-foreground hover:brightness-95',
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
        className: 'gap-2 [&>span:not(.loading-spinner)]:opacity-0 [&>svg]:opacity-0 [&>*:not(.loading-spinner)]:opacity-0',
      },
      // Ghost button hover effects - subtle background changes with brightness adjustments
      {
        variant: 'ghost',
        size: 'icon',
        className: 'hover:bg-surface/60 hover:brightness-98 active:bg-surface/80 active:brightness-95 hover:scale-105 active:scale-100',
      },
      {
        variant: 'ghost',
        size: 'sm',
        className: 'hover:bg-surface/40 hover:brightness-98 active:bg-surface/60 active:brightness-95 hover:scale-[1.02] active:scale-100',
      },
      {
        variant: 'ghost',
        size: 'md',
        className:
          'hover:bg-default-100 hover:brightness-98 active:bg-default-200 active:brightness-95 hover:scale-[1.01] active:scale-100',
      },
      {
        variant: 'ghost',
        size: 'lg',
        className:
          'hover:bg-default-100 hover:brightness-98 active:bg-default-200 active:brightness-95 hover:scale-[1.01] active:scale-100',
      },
    ],
  },
);

export type ButtonProps = {
  asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, fullWidth, isLoading, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, radius, fullWidth, isLoading, className }))}
        ref={ref}
        disabled={isLoading ? true : props.disabled}
        {...props}
      >
        {isLoading ? (
          <span className="loading-spinner absolute inset-0 flex items-center justify-center">
            <Spinner
              size={14}
              width={2}
              color="text-current"
            />
          </span>
        ) : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

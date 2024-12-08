import React from 'react';
import { extendVariants, Button as NextUIButton } from '@nextui-org/react';

export const Button = extendVariants(NextUIButton, {
  variants: {
    // Main variant types that define the button's purpose and behavior
    variant: {
      default: 'bg-surface hover:bg-surface/80 transition-all duration-200 ease-in-out', // Default surface-colored button
      cta: 'bg-monarch-orange text-white hover:bg-monarch-orange/80 transition-all duration-200 ease-in-out', // Primary CTA with orange background
      secondary: 'bg-hovered text-foreground ',
      interactive:
        'bg-hovered text-foreground hover:bg-primary hover:text-white transition-all duration-200 ease-in-out', // Starts subtle, strong hover effect
      ghost: 'bg-transparent hover:bg-surface/5 transition-all duration-200 ease-in-out', // Most subtle variant
    },
    // Size variants
    size: {
      sm: 'px-3 py-1.5 text-xs min-w-[64px] h-8',
      md: 'px-4 py-2 text-sm min-w-[80px] h-10',
      lg: 'px-6 py-3 text-md min-w-[96px] h-12',
    },
    // Rounded corners
    radius: {
      none: 'rounded-none',
      base: 'rounded-sm',
    },
    // Full width option
    fullWidth: {
      true: 'w-full',
    },
    // Loading state
    isLoading: {
      true: 'cursor-not-allowed',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
    radius: 'base',
    fullWidth: false,
  },
  compoundVariants: [
    // Disabled state
    {
      isDisabled: 'true',
      class: 'opacity-50 cursor-not-allowed pointer-events-none',
    },
    // Loading state
    {
      isLoading: true,
      class: 'gap-2 [&>span]:opacity-0 [&>svg]:opacity-0 [&>*:not(.loading-spinner)]:opacity-0',
    },
  ],
});

export type ButtonProps = React.ComponentProps<typeof Button>;

Button.displayName = 'Button';

import React from 'react';
import { extendVariants, Button as NextUIButton } from '@nextui-org/react';

export const Button = extendVariants(NextUIButton, {
  variants: {
    // Color variants
    color: {
      primary: "bg-monarch-orange text-white hover:bg-monarch-orange/90",
      secondary: "bg-surface text-foreground hover:bg-surface/90",
      surface: "bg-surface opacity-80 hover:opacity-100",
      hovered: "bg-hovered opacity-80 hover:opacity-100",
      success: "bg-success text-white hover:bg-success/90",
      warning: "bg-warning text-white hover:bg-warning/90",
      danger: "bg-danger text-white hover:bg-danger/90",
    },
    // Visual style variants
    variant: {
      solid: "border-none",
      bordered: "border-2 bg-transparent",
      light: "bg-surface opacity-80 hover:opacity-100",
      flat: "bg-transparent hover:bg-surface/10",
      ghost: "bg-transparent hover:bg-surface/5",
      shadow: "shadow-lg hover:shadow-xl",
      highlight: "bg-hovered text-foreground hover:bg-primary hover:text-white transition-all duration-200 ease-in-out",
    },
    // Size variants
    size: {
      sm: "px-3 py-1.5 text-xs min-w-[64px] h-8",
      md: "px-4 py-2 text-sm min-w-[80px] h-10",
      lg: "px-6 py-3 text-md min-w-[96px] h-12",
    },
    // Loading state
    isLoading: {
      true: "cursor-not-allowed",
    },
    // Full width option
    fullWidth: {
      true: "w-full",
    },
    // Rounded corners
    radius: {
      none: "rounded-none",
      sm: "rounded-sm",
      base: "rounded-sm",
      lg: "rounded-sm",
      full: "rounded-sm",
    },
  },
  defaultVariants: {
    color: "primary",
    variant: "solid",
    size: "md",
    radius: "base",
    fullWidth: false,
  },
  compoundVariants: [
    // Bordered variant compounds
    {
      variant: "bordered",
      color: "primary",
      class: "border-monarch-orange text-monarch-orange hover:bg-monarch-orange/10",
    },
    {
      variant: "bordered",
      color: "secondary",
      class: "border-surface text-foreground hover:bg-surface/10",
    },
    // Light variant compounds - override background based on color
    {
      variant: "light",
      color: "surface",
      class: "bg-surface",
    },
    {
      variant: "light",
      color: "hovered",
      class: "bg-hovered",
    },
    // Disabled state compounds
    {
      isDisabled: "true",
      class: "opacity-50 cursor-not-allowed pointer-events-none",
    },
    // Loading state styling
    {
      isLoading: true,
      class: "gap-2 [&>span]:opacity-0 [&>svg]:opacity-0 [&>*:not(.loading-spinner)]:opacity-0",
    },
  ],
});

// Re-export the component type
export type ButtonProps = React.ComponentProps<typeof Button>;

Button.displayName = 'Button';

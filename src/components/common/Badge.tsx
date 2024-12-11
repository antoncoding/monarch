import { ReactNode } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';

const badge = tv({
  base: 'inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium',
  variants: {
    variant: {
      default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      primary: 'bg-blue-100 text-blue-600 dark:bg-blue-800/30 dark:text-blue-400',
      success: 'bg-green-100 text-green-600 dark:bg-green-800/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-800/30 dark:text-yellow-400',
      danger: 'bg-red-100 text-red-600 dark:bg-red-800/30 dark:text-red-400',
    },
    size: {
      sm: 'px-1 py-0.5 text-xs',
      md: 'px-1.5 py-0.5 text-xs',
      lg: 'px-2 py-1 text-sm',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export type BadgeProps = {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof badge>;

export function Badge({ children, variant, size, className }: BadgeProps) {
  return <span className={badge({ variant, size, className })}>{children}</span>;
}

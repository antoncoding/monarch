import type React from 'react';
import { ModalBody as HeroModalBody } from '@heroui/react';
import { twMerge } from 'tailwind-merge';

export type ModalBodyVariant = 'standard' | 'compact';

type ModalBodyProps = {
  children: React.ReactNode;
  variant?: ModalBodyVariant;
  className?: string;
};

export function ModalBody({ children, variant = 'standard', className = '' }: ModalBodyProps) {
  const isStandard = variant === 'standard';
  const paddingClass = isStandard ? 'px-6 pb-6 pt-2' : 'px-6 pb-4 pt-2';
  const gapClass = isStandard ? 'gap-5' : 'gap-4';

  return <HeroModalBody className={twMerge(`flex flex-col ${gapClass} font-zen`, paddingClass, className)}>{children}</HeroModalBody>;
}

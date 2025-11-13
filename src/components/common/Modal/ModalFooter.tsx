import React from 'react';
import { ModalFooter as HeroModalFooter } from '@heroui/react';

type ModalFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <HeroModalFooter className={`font-zen ${className}`}>
      {children}
    </HeroModalFooter>
  );
}

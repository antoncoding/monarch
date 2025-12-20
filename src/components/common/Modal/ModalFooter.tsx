import type React from 'react';

type ModalFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return <div className={`flex items-center justify-end gap-2 px-6 pb-6 font-zen ${className}`}>{children}</div>;
}

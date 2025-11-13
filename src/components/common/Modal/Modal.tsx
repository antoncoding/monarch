'use client';

import React, { useEffect, useState } from 'react';
import { Modal as HeroModal, ModalContent } from '@heroui/react';

export type ModalVariant = 'standard' | 'compact' | 'custom';
export type ModalZIndex = 'base' | 'process' | 'selection' | 'settings' | 'custom';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange?: () => void;
  children: React.ReactNode | ((onClose: () => void) => React.ReactNode);
  zIndex?: ModalZIndex;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  isDismissable?: boolean;
  hideCloseButton?: boolean;
  scrollBehavior?: 'inside' | 'outside' | 'normal';
  backdrop?: 'transparent' | 'opaque' | 'blur';
  className?: string;
};

const Z_INDEX_MAP: Record<ModalZIndex, { wrapper: string; backdrop: string }> = {
  base: { wrapper: 'z-[2000]', backdrop: 'z-[1990]' },
  process: { wrapper: 'z-[2600]', backdrop: 'z-[2590]' },
  selection: { wrapper: 'z-[3000]', backdrop: 'z-[2990]' },
  settings: { wrapper: 'z-[3200]', backdrop: 'z-[3190]' },
  custom: { wrapper: '', backdrop: '' },
};

export function Modal({
  isOpen,
  onClose,
  onOpenChange,
  children,
  zIndex = 'base',
  size = 'xl',
  isDismissable = true,
  hideCloseButton = true,
  scrollBehavior = 'inside',
  backdrop = 'blur',
  className = '',
}: ModalProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  const zIndexClasses = Z_INDEX_MAP[zIndex];
  const backdropStyle =
    backdrop === 'transparent'
      ? 'bg-transparent'
      : 'bg-black/70 backdrop-blur-md';

  return (
    <HeroModal
      isOpen={isOpen}
      onClose={onClose}
      onOpenChange={onOpenChange}
      size={size}
      isDismissable={isDismissable}
      hideCloseButton={hideCloseButton}
      scrollBehavior={scrollBehavior}
      backdrop={backdrop}
      portalContainer={portalContainer ?? undefined}
      classNames={{
        wrapper: `${zIndexClasses.wrapper} pointer-events-auto`,
        backdrop: `${zIndexClasses.backdrop} ${backdropStyle}`,
        base: `${zIndexClasses.wrapper}`,
      }}
    >
      <ModalContent
        className={`relative z-[5] font-zen rounded-sm border border-white/10 bg-surface text-primary shadow-2xl ${className}`}
      >
        {(closeModal) =>
          typeof children === 'function' ? children(closeModal) : children}
      </ModalContent>
    </HeroModal>
  );
}

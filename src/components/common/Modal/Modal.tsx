import React from 'react';
import { Modal as HeroModal, ModalContent } from '@heroui/react';

export type ModalVariant = 'standard' | 'compact' | 'custom';
export type ModalZIndex = 'base' | 'process' | 'selection' | 'settings' | 'custom';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange?: () => void;
  children: React.ReactNode;
  variant?: ModalVariant;
  zIndex?: ModalZIndex;
  customZIndex?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  isDismissable?: boolean;
  hideCloseButton?: boolean;
  scrollBehavior?: 'inside' | 'outside' | 'normal';
  backdrop?: 'transparent' | 'opaque' | 'blur';
  className?: string;
};

const Z_INDEX_MAP: Record<ModalZIndex, { wrapper: string; backdrop: string }> = {
  base: { wrapper: 'z-50', backdrop: 'z-[45]' },
  process: { wrapper: 'z-[1100]', backdrop: 'z-[1090]' },
  selection: { wrapper: 'z-[2200]', backdrop: 'z-[2190]' },
  settings: { wrapper: 'z-[2300]', backdrop: 'z-[2290]' },
  custom: { wrapper: '', backdrop: '' },
};

export function Modal({
  isOpen,
  onClose,
  onOpenChange,
  children,
  variant = 'standard',
  zIndex = 'base',
  customZIndex,
  size = 'xl',
  isDismissable = true,
  hideCloseButton = false,
  scrollBehavior = 'inside',
  backdrop = 'blur',
  className = '',
}: ModalProps) {
  const zIndexClasses = customZIndex
    ? { wrapper: `z-[${customZIndex}]`, backdrop: `z-[${customZIndex - 10}]` }
    : Z_INDEX_MAP[zIndex];

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
      classNames={{
        wrapper: zIndexClasses.wrapper,
        backdrop: zIndexClasses.backdrop,
      }}
    >
      <ModalContent className={`font-zen ${className}`}>
        {(closeModal) => (
          <>
            {typeof children === 'function' ? children(closeModal) : children}
          </>
        )}
      </ModalContent>
    </HeroModal>
  );
}

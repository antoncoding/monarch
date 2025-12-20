import type React from 'react';
import { useCallback } from 'react';
import { Root, Portal, Overlay, Content, Title } from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

import { cn } from '@/utils/components';

export type ModalVariant = 'standard' | 'compact' | 'custom';
export type ModalZIndex = 'base' | 'process' | 'selection' | 'settings' | 'custom';

type ModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode | ((onClose: () => void) => React.ReactNode);
  title?: string;
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

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-full',
};

export function Modal({
  isOpen,
  onOpenChange,
  children,
  title = 'Dialog',
  zIndex = 'base',
  size = 'xl',
  isDismissable = true,
  hideCloseButton = true,
  scrollBehavior = 'inside',
  backdrop = 'blur',
  className = '',
}: ModalProps) {
  const zIndexClasses = Z_INDEX_MAP[zIndex];
  const backdropStyle =
    backdrop === 'transparent' ? 'bg-transparent' : backdrop === 'opaque' ? 'bg-black/70' : 'bg-black/70 backdrop-blur-md';

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isDismissable) return;
      onOpenChange(open);
    },
    [isDismissable, onOpenChange],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      modal
    >
      <Portal>
        <Overlay
          className={cn(
            'fixed inset-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            zIndexClasses.backdrop,
            backdropStyle,
          )}
        />
        <Content
          className={cn(
            'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw]',
            'rounded-sm border border-white/10 bg-surface text-primary shadow-2xl font-zen',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            zIndexClasses.wrapper,
            SIZE_MAP[size],
            scrollBehavior === 'inside' && 'max-h-[85vh] overflow-y-auto',
            className,
          )}
          onPointerDownOutside={(e) => {
            if (!isDismissable) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (!isDismissable) {
              e.preventDefault();
            }
          }}
        >
          <VisuallyHidden>
            <Title>{title}</Title>
          </VisuallyHidden>
          {typeof children === 'function' ? children(handleClose) : children}
        </Content>
      </Portal>
    </Root>
  );
}

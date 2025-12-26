'use client';

import { Suspense } from 'react';
import { useModalStore } from '@/stores/useModalStore';
import { MODAL_REGISTRY } from '@/modals/registry';

/**
 * ModalRenderer automatically renders all active modals from the store.
 * Should be placed once in the root layout or app wrapper.
 *
 * Features:
 * - Renders modals from the Zustand store stack
 * - Supports multiple modals (stacking)
 * - Lazy loads modal components for code splitting
 * - Handles modal close automatically
 * - Adapts between modal store API and component props
 *
 * @example
 * ```tsx
 * // In root layout or _app:
 * <ModalRenderer />
 * ```
 */
export function ModalRenderer() {
  const { stack, close } = useModalStore();

  return (
    <>
      {stack.map((modal) => {
        const ModalComponent = MODAL_REGISTRY[modal.type];

        if (!ModalComponent) {
          console.warn(`Modal type "${modal.type}" not found in registry`);
          return null;
        }

        // Adapt props: modals use onOpenChange, we provide onClose
        const handleClose = () => close(modal.id);

        return (
          <Suspense
            key={modal.id}
            fallback={null}
          >
            <ModalComponent
              {...(modal.props as any)}
              isOpen
              onClose={handleClose}
              onOpenChange={(open: boolean) => {
                if (!open) handleClose();
              }}
            />
          </Suspense>
        );
      })}
    </>
  );
}

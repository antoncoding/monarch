import { useCallback } from 'react';
import { useModalStore, type ModalType, type ModalProps } from '@/stores/useModalStore';

/**
 * Convenience hook for opening and closing modals.
 * Provides a clean API for interacting with the modal system.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { open, close, closeAll } = useModal();
 *
 *   const handleSwap = () => {
 *     open('bridgeSwap', { targetToken: myToken });
 *   };
 *
 *   const handleCloseSupply = () => {
 *     close('supply');
 *   };
 *
 *   return <button onClick={handleSwap}>Swap</button>;
 * }
 * ```
 */
export function useModal() {
  const store = useModalStore();

  /**
   * Open a modal with type-safe props.
   * Returns a unique modal ID that can be used to close this specific instance.
   */
  const open = useCallback(
    <T extends ModalType>(type: T, props: ModalProps[T]) => {
      return store.open(type, props);
    },
    [store],
  );

  /**
   * Close a specific modal by type or ID.
   * If type is provided, closes the topmost modal of that type.
   * If ID is provided, closes that specific modal instance.
   */
  const close = useCallback(
    (typeOrId: ModalType | string) => {
      store.close(typeOrId);
    },
    [store],
  );

  /**
   * Close all open modals.
   */
  const closeAll = useCallback(() => {
    store.closeAll();
  }, [store]);

  /**
   * Check if a specific modal type is currently open.
   */
  const isOpen = useCallback(
    (type: ModalType) => {
      return store.isOpen(type);
    },
    [store],
  );

  /**
   * Get props for a specific modal type.
   * Useful inside modal components to access their props.
   */
  const getModalProps = useCallback(
    <T extends ModalType>(type: T) => {
      return store.getModalProps(type);
    },
    [store],
  );

  return {
    open,
    close,
    closeAll,
    isOpen,
    getModalProps,
    /**
     * Direct access to the modal stack (use sparingly).
     */
    stack: store.stack,
  };
}

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';

type ModalContent = Exclude<ReactNode, Promise<any>>;

type ModalContextType = {
  openModal: (content: ModalContent) => void;
  closeModal: () => void;
  toggleModal: (content: ModalContent) => void;
  isOpen: boolean;
};

const GlobalModalContext = createContext<ModalContextType | undefined>(undefined);

export function GlobalModalProvider({ children }: { children: ReactNode }) {
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  const openModal = useCallback((content: ModalContent) => {
    setModalContent(content);
  }, []);

  const closeModal = useCallback(() => {
    setModalContent(null);
  }, []);

  const toggleModal = useCallback((content: ModalContent) => {
    // If any modal is currently open, close it
    // Otherwise, open the new content
    setModalContent((current) => (current ? null : content));
  }, []);

  const value = useMemo(
    () => ({ openModal, closeModal, toggleModal, isOpen: !!modalContent }),
    [openModal, closeModal, toggleModal, modalContent],
  );

  return (
    <GlobalModalContext.Provider value={value}>
      {children}

      {/* Render whatever modal content was passed */}
      {modalContent}
    </GlobalModalContext.Provider>
  );
}

export function useGlobalModal() {
  const context = useContext(GlobalModalContext);
  if (!context) {
    throw new Error('useGlobalModal must be used within GlobalModalProvider');
  }
  return context;
}

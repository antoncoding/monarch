import { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';

type ModalContextType = {
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
  toggleModal: (content: ReactNode) => void;
  isOpen: boolean;
};

const GlobalModalContext = createContext<ModalContextType | undefined>(undefined);

export function GlobalModalProvider({ children }: { children: ReactNode }) {
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);

  const openModal = useCallback((content: ReactNode) => {
    setModalContent(content);
  }, []);

  const closeModal = useCallback(() => {
    setModalContent(null);
  }, []);

  const toggleModal = useCallback((content: ReactNode) => {
    // If any modal is currently open, close it
    // Otherwise, open the new content
    setModalContent((current) => (current ? null : content));
  }, []);

  const value = useMemo(
    () => ({ openModal, closeModal, toggleModal, isOpen: !!modalContent }),
    [openModal, closeModal, toggleModal, modalContent]
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

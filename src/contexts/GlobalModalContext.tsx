import { createContext, useContext, useState, ReactNode } from 'react';

type ModalContextType = {
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
  toggleModal: (content: ReactNode) => void;
  isOpen: boolean;
};

const GlobalModalContext = createContext<ModalContextType | undefined>(undefined);

export function GlobalModalProvider({ children }: { children: ReactNode }) {
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);

  const openModal = (content: ReactNode) => {
    setModalContent(content);
  };

  const closeModal = () => {
    setModalContent(null);
  };

  const toggleModal = (content: ReactNode) => {
    // If any modal is currently open, close it
    // Otherwise, open the new content
    if (modalContent) {
      closeModal();
    } else {
      openModal(content);
    }
  };

  return (
    <GlobalModalContext.Provider
      value={{ openModal, closeModal, toggleModal, isOpen: !!modalContent }}
    >
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

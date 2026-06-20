'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';

type WalletModalContextValue = {
  openWalletModal: () => void;
};

const WalletModalContext = createContext<WalletModalContextValue | undefined>(undefined);

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const { openAccountModal } = useAccountModal();
  const { openConnectModal } = useConnectModal();

  const openWalletModal = useCallback(() => {
    if (openConnectModal) {
      openConnectModal();
      return;
    }

    openAccountModal?.();
  }, [openAccountModal, openConnectModal]);

  const contextValue = useMemo(() => ({ openWalletModal }), [openWalletModal]);

  return <WalletModalContext.Provider value={contextValue}>{children}</WalletModalContext.Provider>;
}

export function useWalletModal(): WalletModalContextValue {
  const context = useContext(WalletModalContext);
  if (!context) {
    throw new Error('useWalletModal must be used within WalletModalProvider');
  }
  return context;
}

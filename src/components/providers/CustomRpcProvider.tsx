'use client';

import { createContext, useContext, useEffect, useState, type ReactNode, useMemo } from 'react';
import { useCustomRpc, type CustomRpcUrls } from '@/hooks/useCustomRpc';
import type { SupportedNetworks } from '@/utils/networks';

type CustomRpcContextType = {
  customRpcUrls: CustomRpcUrls;
  setRpcUrl: (chainId: SupportedNetworks, url: string | undefined) => void;
  resetRpcUrl: (chainId: SupportedNetworks) => void;
  resetAllRpcUrls: () => void;
  isUsingCustomRpc: (chainId: SupportedNetworks) => boolean;
  hasAnyCustomRpcs: () => boolean;
  rpcConfigVersion: number; // Used to trigger wagmi config recreation
};

const CustomRpcContext = createContext<CustomRpcContextType | undefined>(undefined);

export function CustomRpcProvider({ children }: { children: ReactNode }) {
  const customRpcHook = useCustomRpc();
  const [rpcConfigVersion, setRpcConfigVersion] = useState(0);

  // Increment version when custom RPCs change to trigger wagmi config recreation
  useEffect(() => {
    setRpcConfigVersion((prev) => prev + 1);
  }, [customRpcHook.customRpcUrls]);

  const contextValue: CustomRpcContextType = useMemo(
    () => ({
      ...customRpcHook,
      rpcConfigVersion,
    }),
    [customRpcHook, rpcConfigVersion],
  );

  return <CustomRpcContext.Provider value={contextValue}>{children}</CustomRpcContext.Provider>;
}

export function useCustomRpcContext(): CustomRpcContextType {
  const context = useContext(CustomRpcContext);
  if (context === undefined) {
    throw new Error('useCustomRpcContext must be used within a CustomRpcProvider');
  }
  return context;
}

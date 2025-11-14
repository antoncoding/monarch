import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccountEffect } from 'wagmi';

import { useStyledToast } from '@/hooks/useStyledToast';

type ConnectRedirectContextType = {
  setRedirectPath: (path: string | undefined) => void;
};

const ConnectRedirectContext = createContext<ConnectRedirectContextType | undefined>(undefined);

export function ConnectRedirectProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [redirectPath, setRedirectPath] = useState<string | undefined>();

  const toast = useStyledToast();

  useAccountEffect({
    onConnect: ({ address, isReconnected }) => {
      if (redirectPath && !isReconnected) {
        router.push(`/${redirectPath}/${address}`);
        toast.success('Address connected', 'Redirecting to portfolio...', {
          id: 'address-connected',
        });
        // Reset the path after redirect
        setRedirectPath(undefined);
      }
    },
  });

  const handleSetRedirectPath = useCallback((path: string | undefined) => {
    setRedirectPath(path);
  }, []);

  const value = useMemo(() => {
    return {
      setRedirectPath: handleSetRedirectPath,
    };
  }, [handleSetRedirectPath]);

  return (
    <ConnectRedirectContext.Provider value={value}>{children}</ConnectRedirectContext.Provider>
  );
}

export function useConnectRedirect() {
  const context = useContext(ConnectRedirectContext);
  if (!context) {
    throw new Error('useConnectRedirect must be used within a ConnectRedirectProvider');
  }
  return context;
}

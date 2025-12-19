import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useCreateVault } from '@/hooks/useCreateVault';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import type { SupportedNetworks } from '@/utils/networks';

// Keeping enum for backwards compatibility but not using steps anymore
export enum DeploymentStep {
  TOKEN_SELECTION = 0,
  DEPLOY = 1,
  SUCCESS = 2,
}

export type SelectedToken = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
};

export type SelectedTokenAndNetwork = {
  token: SelectedToken;
  networkId: SupportedNetworks;
};

type DeploymentContextType = {
  selectedTokenAndNetwork: SelectedTokenAndNetwork | null;
  needSwitchChain: boolean;
  switchToNetwork: () => void;
  createVault: () => Promise<void>;
  isDeploying: boolean;
  setSelectedTokenAndNetwork: (selection: SelectedTokenAndNetwork) => void;
  resetDeployment: () => void;
};

const DeploymentContext = createContext<DeploymentContextType | null>(null);

export function DeploymentProvider({ children }: { children: React.ReactNode }) {
  const [selectedTokenAndNetwork, setSelectedTokenAndNetwork] = useState<SelectedTokenAndNetwork | null>(null);

  const { address: account } = useConnection();

  // Network switching logic
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: selectedTokenAndNetwork?.networkId ?? 1,
  });

  // Vault creation logic
  const { createVault: createVaultTx, isDeploying } = useCreateVault(selectedTokenAndNetwork?.networkId ?? 1);

  const createVault = useCallback(async () => {
    if (!selectedTokenAndNetwork || !account) return;

    await createVaultTx(selectedTokenAndNetwork.token.address);
  }, [selectedTokenAndNetwork, account, createVaultTx]);

  const resetDeployment = useCallback(() => {
    setSelectedTokenAndNetwork(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      selectedTokenAndNetwork,
      needSwitchChain,
      switchToNetwork,
      createVault,
      isDeploying,
      setSelectedTokenAndNetwork,
      resetDeployment,
    }),
    [selectedTokenAndNetwork, needSwitchChain, switchToNetwork, createVault, isDeploying, setSelectedTokenAndNetwork, resetDeployment],
  );

  return <DeploymentContext.Provider value={contextValue}>{children}</DeploymentContext.Provider>;
}

export function useDeployment() {
  const context = useContext(DeploymentContext);
  if (!context) {
    throw new Error('useDeployment must be used within a DeploymentProvider');
  }
  return context;
}

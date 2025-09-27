import { createContext, useContext, useState, useCallback } from 'react';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { SupportedNetworks } from '@/utils/networks';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useCreateVault } from '@/hooks/useCreateVault';

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
  deployedVaultAddress: Address | null;
  predictedVaultAddress: Address | null;
  needSwitchChain: boolean;
  switchToNetwork: () => void;
  createVault: () => Promise<void>;
  isDeploying: boolean;
  setSelectedTokenAndNetwork: (selection: SelectedTokenAndNetwork) => void;
  setDeployedVaultAddress: (address: Address) => void;
  resetDeployment: () => void;
};

const DeploymentContext = createContext<DeploymentContextType | null>(null);

export function DeploymentProvider({ children }: { children: React.ReactNode }) {
  const [selectedTokenAndNetwork, setSelectedTokenAndNetwork] = useState<SelectedTokenAndNetwork | null>(null);
  const [deployedVaultAddress, setDeployedVaultAddress] = useState<Address | null>(null);
  const [predictedVaultAddress, setPredictedVaultAddress] = useState<Address | null>(null);

  const { address: account } = useAccount();

  // Network switching logic
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: selectedTokenAndNetwork?.networkId ?? 1,
  });

  // Vault creation logic
  const { createVault: createVaultTx, isDeploying } = useCreateVault(
    selectedTokenAndNetwork?.networkId ?? 1,
    (vaultAddress: Address) => {
      setDeployedVaultAddress(vaultAddress);
    }
  );

  const createVault = useCallback(async () => {
    if (!selectedTokenAndNetwork || !account) return;

    await createVaultTx(selectedTokenAndNetwork.token.address);
  }, [selectedTokenAndNetwork, account, createVaultTx]);

  const resetDeployment = useCallback(() => {
    setSelectedTokenAndNetwork(null);
    setDeployedVaultAddress(null);
    setPredictedVaultAddress(null);
  }, []);

  return (
    <DeploymentContext.Provider
      value={{
        selectedTokenAndNetwork,
        deployedVaultAddress,
        predictedVaultAddress,
        needSwitchChain,
        switchToNetwork,
        createVault,
        isDeploying,
        setSelectedTokenAndNetwork,
        setDeployedVaultAddress,
        resetDeployment,
      }}
    >
      {children}
    </DeploymentContext.Provider>
  );
}

export function useDeployment() {
  const context = useContext(DeploymentContext);
  if (!context) {
    throw new Error('useDeployment must be used within a DeploymentProvider');
  }
  return context;
}
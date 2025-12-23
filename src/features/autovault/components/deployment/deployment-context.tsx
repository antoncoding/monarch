import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useCreateVault } from '@/hooks/useCreateVault';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { fetchUserVaultV2Addresses } from '@/data-sources/subgraph/v2-vaults';
import type { SupportedNetworks } from '@/utils/networks';

// Keeping enum for backwards compatibility but not using steps anymore
export enum DeploymentStep {
  TOKEN_SELECTION = 0,
  DEPLOY = 1,
  SUCCESS = 2,
}

export type DeploymentPhase = 'selection' | 'deploying' | 'waiting' | 'success';

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
  deploymentPhase: DeploymentPhase;
  deployedVaultAddress: Address | null;
  navigateToVault: () => void;
};

const DeploymentContext = createContext<DeploymentContextType | null>(null);

export function DeploymentProvider({ children }: { children: React.ReactNode }) {
  const [selectedTokenAndNetwork, setSelectedTokenAndNetwork] = useState<SelectedTokenAndNetwork | null>(null);
  const [deploymentPhase, setDeploymentPhase] = useState<DeploymentPhase>('selection');
  const [deployedVaultAddress, setDeployedVaultAddress] = useState<Address | null>(null);
  const [preDeploymentVaultCount, setPreDeploymentVaultCount] = useState(0);

  const { address: account } = useConnection();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Network switching logic
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: selectedTokenAndNetwork?.networkId ?? 1,
  });

  // Vault creation logic
  const { createVault: createVaultTx, isDeploying } = useCreateVault(selectedTokenAndNetwork?.networkId ?? 1);

  // Simplified polling: just check subgraph for vault addresses
  useEffect(() => {
    if (deploymentPhase !== 'waiting' || !selectedTokenAndNetwork || !account) return;

    const checkForNewVault = async () => {
      try {
        // Fetch ONLY addresses from subgraph (fast, reliable)
        const vaultAddresses = await fetchUserVaultV2Addresses(account, selectedTokenAndNetwork.networkId);

        // If we have more vaults than before deployment, a new one was created
        if (vaultAddresses.length > preDeploymentVaultCount) {
          // Get the newest vault (last in array, or we could sort by timestamp if available)
          const newestVault = vaultAddresses.at(-1);
          if (newestVault) {
            setDeployedVaultAddress(newestVault.address as Address);
            setDeploymentPhase('success');
          }

          // Clean up polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error checking for new vault:', error);
      }
    };

    // Initial check
    void checkForNewVault();

    // Poll every 3 seconds
    pollingIntervalRef.current = setInterval(() => {
      void checkForNewVault();
    }, 3000);

    // Optimistic success after 90 seconds (subgraph should have indexed by then)
    timeoutRef.current = setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (deploymentPhase === 'waiting') {
        setDeploymentPhase('success');
      }
    }, 90000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [deploymentPhase, selectedTokenAndNetwork, account, preDeploymentVaultCount]);

  const createVault = useCallback(async () => {
    if (!selectedTokenAndNetwork || !account) return;

    setDeploymentPhase('deploying');

    try {
      // Count existing vaults BEFORE deployment
      const existingVaults = await fetchUserVaultV2Addresses(account, selectedTokenAndNetwork.networkId);
      setPreDeploymentVaultCount(existingVaults.length);

      // Execute deployment
      await createVaultTx(selectedTokenAndNetwork.token.address);

      // Move to waiting phase - polling will start
      setDeploymentPhase('waiting');
    } catch (error) {
      console.error('Vault deployment failed:', error);
      setDeploymentPhase('selection');
    }
  }, [selectedTokenAndNetwork, account, createVaultTx]);

  const navigateToVault = useCallback(() => {
    if (deployedVaultAddress && selectedTokenAndNetwork) {
      window.location.href = `/autovault/${selectedTokenAndNetwork.networkId}/${deployedVaultAddress}`;
    }
  }, [deployedVaultAddress, selectedTokenAndNetwork]);

  const resetDeployment = useCallback(() => {
    setSelectedTokenAndNetwork(null);
    setDeploymentPhase('selection');
    setDeployedVaultAddress(null);
    setPreDeploymentVaultCount(0);

    // Clean up any active polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
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
      deploymentPhase,
      deployedVaultAddress,
      navigateToVault,
    }),
    [
      selectedTokenAndNetwork,
      needSwitchChain,
      switchToNetwork,
      createVault,
      isDeploying,
      setSelectedTokenAndNetwork,
      resetDeployment,
      deploymentPhase,
      deployedVaultAddress,
      navigateToVault,
    ],
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

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import { decodeEventLog } from 'viem';
import { useRouter } from 'next/navigation';
import { usePublicClient } from 'wagmi';
import { useCreateVault } from '@/hooks/useCreateVault';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { abi as vaultFactoryAbi } from '@/abis/vaultv2factory';
import type { SupportedNetworks } from '@/utils/networks';

export type DeploymentPhase = 'selection' | 'deploying' | 'success';

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

  const router = useRouter();
  const publicClient = usePublicClient({ chainId: selectedTokenAndNetwork?.networkId });

  // Network switching logic
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: selectedTokenAndNetwork?.networkId ?? 1,
  });

  // Vault creation logic
  const { createVault: createVaultTx, isDeploying } = useCreateVault(selectedTokenAndNetwork?.networkId ?? 1);

  const createVault = useCallback(async () => {
    if (!selectedTokenAndNetwork || !publicClient) return;

    setDeploymentPhase('deploying');

    try {
      // Execute deployment and get transaction hash
      const txHash = await createVaultTx(selectedTokenAndNetwork.token.address);

      if (!txHash) {
        setDeploymentPhase('selection');
        return;
      }

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Parse CreateVaultV2 event to get vault address
      const createEvent = receipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({
            abi: vaultFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'CreateVaultV2';
        } catch {
          return false;
        }
      });

      if (createEvent) {
        const decoded = decodeEventLog({
          abi: vaultFactoryAbi,
          data: createEvent.data,
          topics: createEvent.topics,
        });

        // Extract vault address from event
        const vaultAddress = (decoded.args as any).newVaultV2 as Address;
        setDeployedVaultAddress(vaultAddress);
        setDeploymentPhase('success');
      } else {
        setDeploymentPhase('selection');
      }
    } catch (_error) {
      setDeploymentPhase('selection');
    }
  }, [selectedTokenAndNetwork, createVaultTx, publicClient]);

  const navigateToVault = useCallback(() => {
    if (deployedVaultAddress && selectedTokenAndNetwork) {
      router.push(`/autovault/${selectedTokenAndNetwork.networkId}/${deployedVaultAddress}`);
    }
  }, [deployedVaultAddress, selectedTokenAndNetwork, router]);

  const resetDeployment = useCallback(() => {
    setSelectedTokenAndNetwork(null);
    setDeploymentPhase('selection');
    setDeployedVaultAddress(null);
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

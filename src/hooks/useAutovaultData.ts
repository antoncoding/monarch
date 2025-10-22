import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { MorphoChainlinkOracleData } from '@/utils/types';

export type VaultAllocation = {
  marketId: string;
  chainId: number;
  collateralAddress: Address;
  collateralSymbol: string;
  assetSymbol: string;
  allocationFormatted: string;
  apy: number | null;
  lltv: number | null;
  oracleData: MorphoChainlinkOracleData | null;
  allocationPercent: number | null;
};

export type AutovaultStatus = 'active' | 'paused' | 'inactive';

export type AutovaultAgent = {
  id: string;
  name: string;
  description: string;
  status: AutovaultStatus;
  performance: {
    totalValue: bigint;
    apr: number;
    totalReturns: bigint;
  };
};

export type AutovaultData = {
  id: string;
  address: Address;
  name: string;
  symbol?: string;
  description: string;
  totalValue: bigint;
  currentApy: number;
  agents: AutovaultAgent[];
  status: AutovaultStatus;
  owner: Address;
  createdAt: Date;
  lastActivity: Date;
  rebalanceHistory: {
    timestamp: Date;
    fromMarket: string;
    toMarket: string;
    amount: bigint;
    reason: string;
  }[];
  allocations?: VaultAllocation[];
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

const createEmptyVault = (address?: Address): AutovaultData => {
  const safeAddress = address ?? ZERO_ADDRESS;
  return {
    id: 'empty',
    address: safeAddress,
    name: '',
    symbol: '',
    description: '',
    totalValue: 0n,
    currentApy: 0,
    agents: [],
    status: 'inactive',
    owner: ZERO_ADDRESS,
    createdAt: new Date(0),
    lastActivity: new Date(0),
    rebalanceHistory: [],
    allocations: [],
  };
};

type UseAutovaultDataResult = {
  autovaults: AutovaultData[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useAutovaultData(account?: Address): UseAutovaultDataResult {
  const [autovaults, setAutovaults] = useState<AutovaultData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAutovaultData = async () => {
    if (!account) {
      setAutovaults([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      // TODO: Replace with actual API call
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // TODO: Implement actual autovault data fetching
      // This should fetch vaults owned by the specific address
      // Query your smart contracts or backend API
      const mockData: AutovaultData[] = [];

      // Filter to only include vaults owned by the connected address
      const ownedVaults = mockData.filter(
        (vault) => vault.owner.toLowerCase() === account.toLowerCase(),
      );

      setAutovaults(ownedVaults);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch autovault data'));
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    await fetchAutovaultData();
  };

  useEffect(() => {
    void fetchAutovaultData();
  }, [account]);

  return {
    autovaults,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// Hook to check if user has any active autovaults
export function useHasActiveAutovaults(account?: Address): {
  hasActiveVaults: boolean;
  isLoading: boolean;
} {
  const { autovaults, isLoading } = useAutovaultData(account);

  const hasActiveVaults = autovaults.some((vault) => vault.status === 'active');

  return {
    hasActiveVaults,
    isLoading,
  };
}

// Hook to get specific vault details by vault address
export function useVaultDetails(vaultAddress?: Address): {
  vault: AutovaultData;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [vault, setVault] = useState<AutovaultData>(() => createEmptyVault(vaultAddress));
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVaultDetails = async () => {
    if (!vaultAddress) {
      setVault(createEmptyVault());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      // TODO: Replace with actual API call
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // TODO: Implement actual vault details fetching
      // This should fetch vault details from your smart contracts
      // const vaultData = await fetchVaultFromContract(vaultAddress);

      // Mock data - replace with actual implementation
      const mockVault: AutovaultData | null = null;

      setVault(mockVault ?? createEmptyVault(vaultAddress));
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch vault details'));
      setVault(createEmptyVault(vaultAddress));
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    await fetchVaultDetails();
  };

  useEffect(() => {
    setVault(createEmptyVault(vaultAddress));
    void fetchVaultDetails();
  }, [vaultAddress]);

  return {
    vault,
    isLoading,
    isError,
    error,
    refetch,
  };
}

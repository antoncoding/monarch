import { useMemo } from 'react';
import { getChainAddresses } from '@morpho-org/blue-sdk';
import { type Address, isAddressEqual, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import type { SwapLeverageRoute } from './types';

type LeverageRouteMode = 'swap' | 'erc4626';

type UseLeverageRouteAvailabilityParams = {
  chainId: number;
  collateralTokenAddress: string;
  loanTokenAddress: string;
};

type UseLeverageRouteAvailabilityResult = {
  swapRoute: SwapLeverageRoute | null;
  isErc4626ModeAvailable: boolean;
  availableRouteModes: LeverageRouteMode[];
  isErc4626ProbeLoading: boolean;
  isErc4626ProbeRefetching: boolean;
  erc4626ProbeError: unknown;
  hasAnyRoute: boolean;
};

export function useLeverageRouteAvailability({
  chainId,
  collateralTokenAddress,
  loanTokenAddress,
}: UseLeverageRouteAvailabilityParams): UseLeverageRouteAvailabilityResult {
  const swapRoute = useMemo<SwapLeverageRoute | null>(() => {
    try {
      const chainAddresses = getChainAddresses(chainId);
      const bundler3Addresses = chainAddresses?.bundler3;
      if (!bundler3Addresses?.bundler3 || !bundler3Addresses.generalAdapter1 || !bundler3Addresses.paraswapAdapter) {
        return null;
      }

      return {
        kind: 'swap',
        bundler3Address: bundler3Addresses.bundler3 as Address,
        generalAdapterAddress: bundler3Addresses.generalAdapter1 as Address,
        paraswapAdapterAddress: bundler3Addresses.paraswapAdapter as Address,
      };
    } catch {
      return null;
    }
  }, [chainId]);

  const {
    data: erc4626ProbeData,
    isLoading: isErc4626ProbeLoading,
    isRefetching: isErc4626ProbeRefetching,
    error: erc4626ProbeError,
  } = useReadContracts({
    contracts: [
      {
        address: collateralTokenAddress as Address,
        abi: erc4626Abi,
        functionName: 'asset',
        args: [],
        chainId,
      },
    ],
    allowFailure: true,
    query: {
      enabled: !!collateralTokenAddress && collateralTokenAddress !== zeroAddress,
    },
  });

  const isErc4626ModeAvailable = useMemo(() => {
    const erc4626Asset = erc4626ProbeData?.[0]?.result as Address | undefined;
    return !!erc4626Asset && erc4626Asset !== zeroAddress && isAddressEqual(erc4626Asset, loanTokenAddress as Address);
  }, [erc4626ProbeData, loanTokenAddress]);

  const availableRouteModes = useMemo<LeverageRouteMode[]>(() => {
    const modes: LeverageRouteMode[] = [];
    // Prefer deterministic ERC4626 route by default when available.
    if (isErc4626ModeAvailable) modes.push('erc4626');
    if (swapRoute) modes.push('swap');
    return modes;
  }, [isErc4626ModeAvailable, swapRoute]);

  return {
    swapRoute,
    isErc4626ModeAvailable,
    availableRouteModes,
    isErc4626ProbeLoading,
    isErc4626ProbeRefetching,
    erc4626ProbeError,
    hasAnyRoute: availableRouteModes.length > 0,
  };
}

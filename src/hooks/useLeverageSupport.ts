import { useMemo } from 'react';
import { getChainAddresses } from '@morpho-org/blue-sdk';
import { type Address, isAddressEqual, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import type { Market } from '@/utils/types';
import type { Erc4626LeverageRoute, LeverageSupport, SwapLeverageRoute } from './leverage/types';

type UseLeverageSupportParams = {
  market: Market;
};

/**
 * Detects whether a market can be levered/delevered with deterministic V2 routes.
 *
 * Supported route:
 * - ERC4626 collateral where `vault.asset() == loanToken`
 */
export function useLeverageSupport({ market }: UseLeverageSupportParams): LeverageSupport {
  const loanToken = market.loanAsset.address as Address;
  const collateralToken = market.collateralAsset.address as Address;
  const chainId = market.morphoBlue.chain.id;

  const { data, isLoading, isRefetching } = useReadContracts({
    contracts: [
      {
        address: collateralToken,
        abi: erc4626Abi,
        functionName: 'asset',
        args: [],
        chainId,
      },
    ],
    allowFailure: true,
    query: {
      enabled: !!collateralToken && collateralToken !== zeroAddress,
    },
  });

  return useMemo((): LeverageSupport => {
    const erc4626Asset = data?.[0]?.result as Address | undefined;
    const hasErc4626Asset = !!erc4626Asset && erc4626Asset !== zeroAddress;

    if (hasErc4626Asset && isAddressEqual(erc4626Asset, loanToken)) {
      const route: Erc4626LeverageRoute = {
        kind: 'erc4626',
        collateralVault: collateralToken,
        underlyingLoanToken: loanToken,
      };

      return {
        isSupported: true,
        supportsLeverage: true,
        supportsDeleverage: true,
        isLoading: isLoading || isRefetching,
        route,
        reason: null,
      };
    }

    if (!isLoading && !isRefetching) {
      try {
        // Bundler3 adapter addresses are sourced from the canonical blue-sdk chain registry.
        // They are not hardcoded in this repository.
        const chainAddresses = getChainAddresses(chainId);
        const bundler3Addresses = chainAddresses?.bundler3;

        if (bundler3Addresses?.bundler3 && bundler3Addresses.generalAdapter1 && bundler3Addresses.paraswapAdapter) {
          const route: SwapLeverageRoute = {
            kind: 'swap',
            bundler3Address: bundler3Addresses.bundler3 as Address,
            generalAdapterAddress: bundler3Addresses.generalAdapter1 as Address,
            paraswapAdapterAddress: bundler3Addresses.paraswapAdapter as Address,
          };

          return {
            isSupported: true,
            supportsLeverage: true,
            supportsDeleverage: false,
            isLoading: false,
            route,
            reason: 'Deleverage is not yet available for swap-backed leverage routes.',
          };
        }
      } catch {
        // Unsupported chain in the blue-sdk addresses registry.
      }
    }

    return {
      isSupported: false,
      supportsLeverage: false,
      supportsDeleverage: false,
      isLoading: isLoading || isRefetching,
      route: null,
      reason: 'Leverage is currently available for ERC4626 routes on Bundler V2, or swap routes where Bundler3 + Paraswap adapter are deployed.',
    };
  }, [chainId, collateralToken, loanToken, data, isLoading, isRefetching]);
}

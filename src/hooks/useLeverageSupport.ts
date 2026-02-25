import { useMemo } from 'react';
import { type Address, isAddressEqual, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import { getCanonicalStEthAddress, getCanonicalWethAddress, getCanonicalWstEthAddress } from '@/types/token';
import { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import type { LeverageSupport, StEthLeverageRoute, Erc4626LeverageRoute } from './leverage/types';

type UseLeverageSupportParams = {
  market: Market;
};

/**
 * Detects whether a market can be levered/delevered with deterministic V2 routes.
 *
 * Supported routes:
 * - ERC4626 collateral where `vault.asset() == loanToken`
 * - wstETH collateral paired with either:
 *   - stETH loan (leverage + deleverage), or
 *   - mainnet WETH loan (leverage only via `unwrapNative -> stakeEth -> wrapStEth`)
 */
export function useLeverageSupport({ market }: UseLeverageSupportParams): LeverageSupport {
  const chainId = market.morphoBlue.chain.id;
  const loanToken = market.loanAsset.address as Address;
  const collateralToken = market.collateralAsset.address as Address;
  const canonicalWstEth = getCanonicalWstEthAddress(chainId);
  const canonicalStEth = getCanonicalStEthAddress(chainId);
  const canonicalWeth = getCanonicalWethAddress(chainId);
  const supportsStEthBundlerRoute = chainId === SupportedNetworks.Mainnet;

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
    const isCanonicalWstEthCollateral = !!canonicalWstEth && isAddressEqual(collateralToken, canonicalWstEth);

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

    if (isCanonicalWstEthCollateral) {
      // `stakeEth` / `wrapStEth` / `unwrapStEth` only exist on the mainnet BundlerV2 variant.
      // ChainAgnosticBundlerV2 does not expose these selectors, so we block route discovery up-front.
      if (!supportsStEthBundlerRoute) {
        return {
          isSupported: false,
          supportsLeverage: false,
          supportsDeleverage: false,
          isLoading: isLoading || isRefetching,
          route: null,
          reason: 'stETH leverage routes are currently supported on mainnet Bundler V2 only.',
        };
      }

      if (!canonicalStEth || canonicalStEth === zeroAddress) {
        return {
          isSupported: false,
          supportsLeverage: false,
          supportsDeleverage: false,
          isLoading: isLoading || isRefetching,
          route: null,
          reason: 'stETH route addresses are not configured for this chain.',
        };
      }

      if (canonicalStEth && isAddressEqual(canonicalStEth, loanToken)) {
        const route: StEthLeverageRoute = {
          kind: 'steth',
          collateralToken,
          stEthToken: canonicalStEth,
          loanMode: 'steth',
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

      if (canonicalWeth && isAddressEqual(loanToken, canonicalWeth)) {
        const route: StEthLeverageRoute = {
          kind: 'steth',
          collateralToken,
          stEthToken: canonicalStEth,
          loanMode: 'mainnet-weth-steth-wsteth',
        };

        return {
          isSupported: true,
          supportsLeverage: true,
          supportsDeleverage: false,
          isLoading: isLoading || isRefetching,
          route,
          reason: 'This market supports leverage only. Deleverage requires a direct stETH-denominated debt token.',
        };
      }
    }

    return {
      isSupported: false,
      supportsLeverage: false,
      supportsDeleverage: false,
      isLoading: isLoading || isRefetching,
      route: null,
      reason: 'Leverage is only available for ERC4626-underlying routes or stETH/wstETH routes on Bundler V2.',
    };
  }, [
    collateralToken,
    loanToken,
    canonicalStEth,
    canonicalWeth,
    canonicalWstEth,
    data,
    isLoading,
    isRefetching,
    supportsStEthBundlerRoute,
  ]);
}

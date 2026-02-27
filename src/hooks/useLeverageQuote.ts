import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import { fetchVeloraPriceRoute, type VeloraPriceRoute } from '@/features/swap/api/velora';
import { computeFlashCollateralAmount, withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

type UseLeverageQuoteParams = {
  chainId: number;
  route: LeverageRoute | null;
  userCollateralAmount: bigint;
  multiplierBps: bigint;
  loanTokenAddress: string;
  loanTokenDecimals: number;
  collateralTokenAddress: string;
  collateralTokenDecimals: number;
  userAddress?: `0x${string}`;
};

export type LeverageQuote = {
  flashCollateralAmount: bigint;
  flashLoanAmount: bigint;
  totalAddedCollateral: bigint;
  isLoading: boolean;
  error: string | null;
  swapPriceRoute: VeloraPriceRoute | null;
};

/**
 * Converts user leverage intent into deterministic route amounts.
 *
 * - `flashCollateralAmount`: extra collateral target sourced via the flash leg
 * - `flashLoanAmount`: debt token flash amount needed to mint that extra collateral
 */
export function useLeverageQuote({
  chainId,
  route,
  userCollateralAmount,
  multiplierBps,
  loanTokenAddress,
  loanTokenDecimals,
  collateralTokenAddress,
  collateralTokenDecimals,
  userAddress,
}: UseLeverageQuoteParams): LeverageQuote {
  const targetFlashCollateralAmount = useMemo(
    () => computeFlashCollateralAmount(userCollateralAmount, multiplierBps),
    [userCollateralAmount, multiplierBps],
  );

  const {
    data: erc4626PreviewMint,
    isLoading: isLoadingErc4626,
    error: erc4626Error,
  } = useReadContract({
    address: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewMint',
    args: [targetFlashCollateralAmount],
    chainId,
    query: {
      enabled: route?.kind === 'erc4626' && targetFlashCollateralAmount > 0n,
    },
  });

  const swapQuoteQuery = useQuery({
    queryKey: [
      'leverage-swap-quote',
      chainId,
      route?.kind === 'swap' ? route.paraswapAdapterAddress : null,
      route?.kind === 'swap' ? route.generalAdapterAddress : null,
      loanTokenAddress,
      loanTokenDecimals,
      collateralTokenAddress,
      collateralTokenDecimals,
      targetFlashCollateralAmount.toString(),
      userAddress ?? null,
    ],
    enabled: route?.kind === 'swap' && targetFlashCollateralAmount > 0n && !!userAddress,
    queryFn: async () => {
      const buyRoute = await fetchVeloraPriceRoute({
        srcToken: loanTokenAddress,
        srcDecimals: loanTokenDecimals,
        destToken: collateralTokenAddress,
        destDecimals: collateralTokenDecimals,
        amount: targetFlashCollateralAmount,
        network: chainId,
        userAddress: userAddress as `0x${string}`,
        side: 'BUY',
      });

      const borrowAssets = BigInt(buyRoute.srcAmount);
      if (borrowAssets <= 0n) {
        return {
          flashLoanAmount: 0n,
          flashCollateralAmount: 0n,
          priceRoute: null,
        };
      }

      const sellRoute = await fetchVeloraPriceRoute({
        srcToken: loanTokenAddress,
        srcDecimals: loanTokenDecimals,
        destToken: collateralTokenAddress,
        destDecimals: collateralTokenDecimals,
        amount: borrowAssets,
        network: chainId,
        userAddress: userAddress as `0x${string}`,
        side: 'SELL',
      });

      return {
        flashLoanAmount: borrowAssets,
        flashCollateralAmount: withSlippageFloor(BigInt(sellRoute.destAmount)),
        priceRoute: sellRoute,
      };
    },
  });

  const swapQuote = useMemo(() => {
    if (route?.kind !== 'swap') {
      return {
        flashLoanAmount: 0n,
        flashCollateralAmount: 0n,
        priceRoute: null,
      };
    }

    return (
      swapQuoteQuery.data ?? {
        flashLoanAmount: 0n,
        flashCollateralAmount: 0n,
        priceRoute: null,
      }
    );
  }, [route, swapQuoteQuery.data]);

  const flashCollateralAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') return swapQuote.flashCollateralAmount;
    return targetFlashCollateralAmount;
  }, [route, targetFlashCollateralAmount, swapQuote.flashCollateralAmount]);

  const flashLoanAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') return swapQuote.flashLoanAmount;
    return (erc4626PreviewMint as bigint | undefined) ?? 0n;
  }, [route, swapQuote.flashLoanAmount, erc4626PreviewMint]);

  const error = useMemo(() => {
    if (!route) return null;
    if (route.kind === 'swap') {
      if (!userAddress && targetFlashCollateralAmount > 0n) return 'Connect wallet to fetch swap-backed leverage route.';
      const routeError = swapQuoteQuery.error;
      if (!routeError) return null;
      return routeError instanceof Error ? routeError.message : 'Failed to quote Velora swap route for leverage.';
    }
    const erc4626RouteError = erc4626Error;
    if (!erc4626RouteError) return null;
    return erc4626RouteError instanceof Error ? erc4626RouteError.message : 'Failed to quote leverage route';
  }, [route, userAddress, targetFlashCollateralAmount, swapQuoteQuery.error, erc4626Error]);

  const isLoading = !!route && (route.kind === 'swap' ? swapQuoteQuery.isLoading || swapQuoteQuery.isFetching : isLoadingErc4626);

  return {
    flashCollateralAmount,
    flashLoanAmount,
    totalAddedCollateral: userCollateralAmount + flashCollateralAmount,
    isLoading,
    error,
    swapPriceRoute: route?.kind === 'swap' ? swapQuote.priceRoute : null,
  };
}

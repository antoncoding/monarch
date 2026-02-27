import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import { fetchVeloraPriceRoute, type VeloraPriceRoute } from '@/features/swap/api/velora';
import { withSlippageCeil, withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

type UseDeleverageQuoteParams = {
  chainId: number;
  route: LeverageRoute | null;
  withdrawCollateralAmount: bigint;
  currentBorrowAssets: bigint;
  loanTokenAddress: string;
  loanTokenDecimals: number;
  collateralTokenAddress: string;
  collateralTokenDecimals: number;
  userAddress?: `0x${string}`;
};

export type DeleverageQuote = {
  repayAmount: bigint;
  rawRouteRepayAmount: bigint;
  maxCollateralForDebtRepay: bigint;
  isLoading: boolean;
  error: string | null;
  swapPriceRoute: VeloraPriceRoute | null;
};

/**
 * Quotes how much debt can be repaid when unwinding a given collateral amount.
 *
 * Routes:
 * - ERC4626: `withdrawCollateralAmount -> previewRedeem` and `previewWithdraw(currentDebt)`
 * - Swap: Velora SELL quote for repay preview and Velora BUY quote for max collateral to close debt
 */
export function useDeleverageQuote({
  chainId,
  route,
  withdrawCollateralAmount,
  currentBorrowAssets,
  loanTokenAddress,
  loanTokenDecimals,
  collateralTokenAddress,
  collateralTokenDecimals,
  userAddress,
}: UseDeleverageQuoteParams): DeleverageQuote {
  const bufferedBorrowAssets = withSlippageCeil(currentBorrowAssets);

  const {
    data: erc4626PreviewRedeem,
    isLoading: isLoadingRedeem,
    error: redeemError,
  } = useReadContract({
    address: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: [withdrawCollateralAmount],
    chainId,
    query: {
      enabled: route?.kind === 'erc4626' && withdrawCollateralAmount > 0n,
    },
  });

  const {
    data: erc4626PreviewWithdrawForDebt,
    isLoading: isLoadingWithdraw,
    error: withdrawError,
  } = useReadContract({
    address: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args: [bufferedBorrowAssets],
    chainId,
    query: {
      enabled: route?.kind === 'erc4626' && bufferedBorrowAssets > 0n,
    },
  });

  const swapRepayQuoteQuery = useQuery({
    queryKey: [
      'deleverage-swap-repay-quote',
      chainId,
      route?.kind === 'swap' ? route.paraswapAdapterAddress : null,
      collateralTokenAddress,
      collateralTokenDecimals,
      loanTokenAddress,
      loanTokenDecimals,
      withdrawCollateralAmount.toString(),
      userAddress ?? null,
    ],
    enabled: route?.kind === 'swap' && withdrawCollateralAmount > 0n && !!userAddress,
    queryFn: async () => {
      const sellRoute = await fetchVeloraPriceRoute({
        srcToken: collateralTokenAddress,
        srcDecimals: collateralTokenDecimals,
        destToken: loanTokenAddress,
        destDecimals: loanTokenDecimals,
        amount: withdrawCollateralAmount,
        network: chainId,
        userAddress: userAddress as `0x${string}`,
        side: 'SELL',
      });

      return {
        rawRouteRepayAmount: withSlippageFloor(BigInt(sellRoute.destAmount)),
        priceRoute: sellRoute,
      };
    },
  });

  const swapMaxCollateralForDebtQuery = useQuery({
    queryKey: [
      'deleverage-swap-max-collateral',
      chainId,
      route?.kind === 'swap' ? route.paraswapAdapterAddress : null,
      collateralTokenAddress,
      collateralTokenDecimals,
      loanTokenAddress,
      loanTokenDecimals,
      bufferedBorrowAssets.toString(),
      userAddress ?? null,
    ],
    enabled: route?.kind === 'swap' && bufferedBorrowAssets > 0n && !!userAddress,
    queryFn: async () => {
      const buyRoute = await fetchVeloraPriceRoute({
        srcToken: collateralTokenAddress,
        srcDecimals: collateralTokenDecimals,
        destToken: loanTokenAddress,
        destDecimals: loanTokenDecimals,
        amount: bufferedBorrowAssets,
        network: chainId,
        userAddress: userAddress as `0x${string}`,
        side: 'BUY',
      });

      return BigInt(buyRoute.srcAmount);
    },
  });

  const swapRepayQuote = useMemo(() => {
    if (route?.kind !== 'swap') {
      return {
        rawRouteRepayAmount: 0n,
        priceRoute: null,
      };
    }

    return (
      swapRepayQuoteQuery.data ?? {
        rawRouteRepayAmount: 0n,
        priceRoute: null,
      }
    );
  }, [route, swapRepayQuoteQuery.data]);

  const rawRouteRepayAmount = useMemo(() => {
    if (!route || withdrawCollateralAmount <= 0n) return 0n;
    if (route.kind === 'swap') return swapRepayQuote.rawRouteRepayAmount;
    return (erc4626PreviewRedeem as bigint | undefined) ?? 0n;
  }, [route, withdrawCollateralAmount, swapRepayQuote.rawRouteRepayAmount, erc4626PreviewRedeem]);

  const repayAmount = useMemo(() => {
    if (rawRouteRepayAmount <= 0n) return 0n;
    return rawRouteRepayAmount > currentBorrowAssets ? currentBorrowAssets : rawRouteRepayAmount;
  }, [rawRouteRepayAmount, currentBorrowAssets]);

  const maxCollateralForDebtRepay = useMemo(() => {
    if (!route || currentBorrowAssets <= 0n) return 0n;
    if (route.kind === 'swap') {
      if (!userAddress) return 0n;
      return swapMaxCollateralForDebtQuery.data ?? 0n;
    }
    return (erc4626PreviewWithdrawForDebt as bigint | undefined) ?? 0n;
  }, [route, currentBorrowAssets, swapMaxCollateralForDebtQuery.data, userAddress, erc4626PreviewWithdrawForDebt]);

  const error = useMemo(() => {
    if (!route) return null;
    if (route.kind === 'swap') {
      if (!userAddress && withdrawCollateralAmount > 0n) {
        return 'Connect wallet to fetch swap-backed deleverage route.';
      }
      const routeError =
        (withdrawCollateralAmount > 0n ? swapRepayQuoteQuery.error : null) ??
        (bufferedBorrowAssets > 0n ? swapMaxCollateralForDebtQuery.error : null);
      if (!routeError) return null;
      return routeError instanceof Error ? routeError.message : 'Failed to quote Velora swap route for deleverage.';
    }
    const routeError = redeemError ?? withdrawError;
    if (!routeError) return null;
    return routeError instanceof Error ? routeError.message : 'Failed to quote deleverage route';
  }, [
    route,
    userAddress,
    withdrawCollateralAmount,
    bufferedBorrowAssets,
    swapRepayQuoteQuery.error,
    swapMaxCollateralForDebtQuery.error,
    redeemError,
    withdrawError,
  ]);

  const isLoading =
    !!route &&
    (route.kind === 'swap'
      ? swapRepayQuoteQuery.isLoading ||
        swapRepayQuoteQuery.isFetching ||
        swapMaxCollateralForDebtQuery.isLoading ||
        swapMaxCollateralForDebtQuery.isFetching
      : isLoadingRedeem || isLoadingWithdraw);

  return {
    repayAmount,
    rawRouteRepayAmount,
    maxCollateralForDebtRepay,
    isLoading,
    error,
    swapPriceRoute: route?.kind === 'swap' ? swapRepayQuote.priceRoute : null,
  };
}

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
  currentBorrowShares: bigint;
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
  canCurrentSellCloseDebt: boolean;
  closeRouteAvailable: boolean;
  closeRouteRequiresResolution: boolean;
  isLoading: boolean;
  error: string | null;
  swapSellPriceRoute: VeloraPriceRoute | null;
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
  currentBorrowShares,
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

      const quotedSellCollateral = BigInt(sellRoute.srcAmount);
      if (quotedSellCollateral !== withdrawCollateralAmount) {
        throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
      }

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

      return {
        maxCollateralForDebtRepay: BigInt(buyRoute.srcAmount),
        priceRoute: buyRoute,
      };
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

  const canCurrentSellCloseDebt = useMemo(() => {
    if (route?.kind !== 'swap' || withdrawCollateralAmount <= 0n || currentBorrowAssets <= 0n) return false;
    return rawRouteRepayAmount >= bufferedBorrowAssets;
  }, [route, withdrawCollateralAmount, currentBorrowAssets, rawRouteRepayAmount, bufferedBorrowAssets]);

  const maxCollateralForDebtRepay = useMemo(() => {
    if (!route || currentBorrowAssets <= 0n) return 0n;
    if (route.kind === 'swap') {
      if (!userAddress || swapMaxCollateralForDebtQuery.error) return 0n;
      return swapMaxCollateralForDebtQuery.data?.maxCollateralForDebtRepay ?? 0n;
    }
    return (erc4626PreviewWithdrawForDebt as bigint | undefined) ?? 0n;
  }, [
    route,
    currentBorrowAssets,
    swapMaxCollateralForDebtQuery.data,
    swapMaxCollateralForDebtQuery.error,
    userAddress,
    erc4626PreviewWithdrawForDebt,
  ]);

  const closeRouteRequiresResolution = useMemo(() => {
    if (route?.kind !== 'swap') return false;
    if (!canCurrentSellCloseDebt) return false;
    if (currentBorrowShares <= 0n) return false;
    if (!userAddress) return false;
    if (swapMaxCollateralForDebtQuery.error) return false;
    return maxCollateralForDebtRepay <= 0n && (swapMaxCollateralForDebtQuery.isLoading || swapMaxCollateralForDebtQuery.isFetching);
  }, [
    route,
    canCurrentSellCloseDebt,
    currentBorrowShares,
    userAddress,
    swapMaxCollateralForDebtQuery.error,
    swapMaxCollateralForDebtQuery.isLoading,
    swapMaxCollateralForDebtQuery.isFetching,
    maxCollateralForDebtRepay,
  ]);

  const closeRouteAvailable = useMemo(() => {
    if (!route || currentBorrowAssets <= 0n) return false;

    if (route.kind === 'swap') {
      if (!userAddress || swapMaxCollateralForDebtQuery.error) return false;
      return canCurrentSellCloseDebt && currentBorrowShares > 0n && maxCollateralForDebtRepay > 0n;
    }

    return maxCollateralForDebtRepay > 0n;
  }, [
    route,
    currentBorrowAssets,
    userAddress,
    swapMaxCollateralForDebtQuery.error,
    canCurrentSellCloseDebt,
    currentBorrowShares,
    maxCollateralForDebtRepay,
  ]);

  const closeRouteResolutionFailed = useMemo(() => {
    if (route?.kind !== 'swap') return false;
    if (!canCurrentSellCloseDebt) return false;
    if (currentBorrowShares <= 0n) return false;
    if (!userAddress) return false;
    if (swapMaxCollateralForDebtQuery.error || closeRouteRequiresResolution) return false;
    return maxCollateralForDebtRepay <= 0n;
  }, [
    route,
    canCurrentSellCloseDebt,
    currentBorrowShares,
    userAddress,
    swapMaxCollateralForDebtQuery.error,
    closeRouteRequiresResolution,
    maxCollateralForDebtRepay,
  ]);

  const error = useMemo(() => {
    if (!route) return null;
    if (route.kind === 'swap') {
      if (!userAddress && withdrawCollateralAmount > 0n) {
        return 'Connect wallet to fetch swap-backed deleverage route.';
      }
      if (closeRouteResolutionFailed) {
        return 'Failed to resolve the exact full-close collateral bound. Refresh the quote and try again.';
      }
      if (canCurrentSellCloseDebt && currentBorrowShares > 0n && swapMaxCollateralForDebtQuery.error) {
        return 'Failed to resolve the exact full-close collateral bound. Refresh the quote and try again.';
      }
      const routeError = withdrawCollateralAmount > 0n ? swapRepayQuoteQuery.error : null;
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
    closeRouteResolutionFailed,
    canCurrentSellCloseDebt,
    currentBorrowShares,
    swapMaxCollateralForDebtQuery.error,
    swapRepayQuoteQuery.error,
    redeemError,
    withdrawError,
  ]);

  const isLoading =
    !!route &&
    (route.kind === 'swap'
      ? swapRepayQuoteQuery.isLoading || swapRepayQuoteQuery.isFetching || closeRouteRequiresResolution
      : isLoadingRedeem || isLoadingWithdraw);

  return {
    repayAmount,
    rawRouteRepayAmount,
    maxCollateralForDebtRepay,
    canCurrentSellCloseDebt,
    closeRouteAvailable,
    closeRouteRequiresResolution,
    isLoading,
    error,
    swapSellPriceRoute: route?.kind === 'swap' ? swapRepayQuote.priceRoute : null,
  };
}

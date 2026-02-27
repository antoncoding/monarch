import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import { withSlippageCeil } from './leverage/math';
import type { Erc4626LeverageRoute } from './leverage/types';

type UseDeleverageQuoteParams = {
  chainId: number;
  route: Erc4626LeverageRoute | null;
  withdrawCollateralAmount: bigint;
  currentBorrowAssets: bigint;
};

export type DeleverageQuote = {
  repayAmount: bigint;
  rawRouteRepayAmount: bigint;
  maxCollateralForDebtRepay: bigint;
  isLoading: boolean;
  error: string | null;
};

/**
 * Quotes how much debt can be repaid when unwinding a given collateral amount.
 *
 * We intentionally quote from `withdrawCollateralAmount -> loanAssets` using redeem
 * side conversions so the callback consumes exactly the requested collateral amount.
 */
export function useDeleverageQuote({
  chainId,
  route,
  withdrawCollateralAmount,
  currentBorrowAssets,
}: UseDeleverageQuoteParams): DeleverageQuote {
  const bufferedBorrowAssets = withSlippageCeil(currentBorrowAssets);

  const {
    data: erc4626PreviewRedeem,
    isLoading: isLoadingRedeem,
    error: redeemError,
  } = useReadContract({
    address: route?.collateralVault,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: [withdrawCollateralAmount],
    chainId,
    query: {
      enabled: !!route && withdrawCollateralAmount > 0n,
    },
  });

  const {
    data: erc4626PreviewWithdrawForDebt,
    isLoading: isLoadingWithdraw,
    error: withdrawError,
  } = useReadContract({
    address: route?.collateralVault,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args: [bufferedBorrowAssets],
    chainId,
    query: {
      enabled: !!route && bufferedBorrowAssets > 0n,
    },
  });

  const rawRouteRepayAmount = useMemo(() => {
    if (!route || withdrawCollateralAmount <= 0n) return 0n;
    return (erc4626PreviewRedeem as bigint | undefined) ?? 0n;
  }, [route, withdrawCollateralAmount, erc4626PreviewRedeem]);

  const repayAmount = useMemo(() => {
    if (rawRouteRepayAmount <= 0n) return 0n;
    return rawRouteRepayAmount > currentBorrowAssets ? currentBorrowAssets : rawRouteRepayAmount;
  }, [rawRouteRepayAmount, currentBorrowAssets]);

  const maxCollateralForDebtRepay = useMemo(() => {
    if (!route || currentBorrowAssets <= 0n) return 0n;
    return (erc4626PreviewWithdrawForDebt as bigint | undefined) ?? 0n;
  }, [route, currentBorrowAssets, erc4626PreviewWithdrawForDebt]);

  const error = useMemo(() => {
    if (!route) return null;
    const routeError = redeemError ?? withdrawError;
    if (!routeError) return null;
    return routeError instanceof Error ? routeError.message : 'Failed to quote deleverage route';
  }, [route, redeemError, withdrawError]);

  const isLoading = !!route && (isLoadingRedeem || isLoadingWithdraw);

  return {
    repayAmount,
    rawRouteRepayAmount,
    maxCollateralForDebtRepay,
    isLoading,
    error,
  };
}

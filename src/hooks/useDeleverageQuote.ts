import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import { wstEthAbi } from '@/abis/wsteth';
import { withSlippageCeil } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

type UseDeleverageQuoteParams = {
  chainId: number;
  route: LeverageRoute | null;
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
  const isErc4626 = route?.kind === 'erc4626';
  const isStEth = route?.kind === 'steth';
  const bufferedBorrowAssets = withSlippageCeil(currentBorrowAssets);

  const {
    data: erc4626PreviewRedeem,
    isLoading: isLoadingRedeem,
    error: redeemError,
  } = useReadContract({
    address: isErc4626 ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: [withdrawCollateralAmount],
    chainId,
    query: {
      enabled: isErc4626 && withdrawCollateralAmount > 0n,
    },
  });

  const {
    data: erc4626PreviewWithdrawForDebt,
    isLoading: isLoadingWithdraw,
    error: withdrawError,
  } = useReadContract({
    address: isErc4626 ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args: [bufferedBorrowAssets],
    chainId,
    query: {
      enabled: isErc4626 && bufferedBorrowAssets > 0n,
    },
  });

  const {
    data: stEthByWstEth,
    isLoading: isLoadingStEthRedeem,
    error: stEthRedeemError,
  } = useReadContract({
    address: isStEth ? route.collateralToken : undefined,
    abi: wstEthAbi,
    functionName: 'getStETHByWstETH',
    args: [withdrawCollateralAmount],
    chainId,
    query: {
      enabled: isStEth && withdrawCollateralAmount > 0n,
    },
  });

  const {
    data: wstEthByStEthDebt,
    isLoading: isLoadingWstDebt,
    error: stEthDebtError,
  } = useReadContract({
    address: isStEth ? route.collateralToken : undefined,
    abi: wstEthAbi,
    functionName: 'getWstETHByStETH',
    args: [bufferedBorrowAssets],
    chainId,
    query: {
      enabled: isStEth && bufferedBorrowAssets > 0n,
    },
  });

  const rawRouteRepayAmount = useMemo(() => {
    if (!route || withdrawCollateralAmount <= 0n) return 0n;
    if (route.kind === 'erc4626') return (erc4626PreviewRedeem as bigint | undefined) ?? 0n;
    return (stEthByWstEth as bigint | undefined) ?? 0n;
  }, [route, withdrawCollateralAmount, erc4626PreviewRedeem, stEthByWstEth]);

  const repayAmount = useMemo(() => {
    if (rawRouteRepayAmount <= 0n) return 0n;
    return rawRouteRepayAmount > currentBorrowAssets ? currentBorrowAssets : rawRouteRepayAmount;
  }, [rawRouteRepayAmount, currentBorrowAssets]);

  const maxCollateralForDebtRepay = useMemo(() => {
    if (!route || currentBorrowAssets <= 0n) return 0n;
    if (route.kind === 'erc4626') return (erc4626PreviewWithdrawForDebt as bigint | undefined) ?? 0n;
    return (wstEthByStEthDebt as bigint | undefined) ?? 0n;
  }, [route, currentBorrowAssets, erc4626PreviewWithdrawForDebt, wstEthByStEthDebt]);

  const error = useMemo(() => {
    if (!route) return null;
    const routeError = route.kind === 'erc4626' ? (redeemError ?? withdrawError) : (stEthRedeemError ?? stEthDebtError);
    if (!routeError) return null;
    return routeError instanceof Error ? routeError.message : 'Failed to quote deleverage route';
  }, [route, redeemError, withdrawError, stEthRedeemError, stEthDebtError]);

  const isLoading =
    route?.kind === 'erc4626'
      ? isLoadingRedeem || isLoadingWithdraw
      : route?.kind === 'steth'
        ? isLoadingStEthRedeem || isLoadingWstDebt
        : false;

  return {
    repayAmount,
    rawRouteRepayAmount,
    maxCollateralForDebtRepay,
    isLoading,
    error,
  };
}

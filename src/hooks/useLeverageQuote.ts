import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import { wstEthAbi } from '@/abis/wsteth';
import { computeFlashCollateralAmount } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

type UseLeverageQuoteParams = {
  chainId: number;
  route: LeverageRoute | null;
  userCollateralAmount: bigint;
  multiplierBps: bigint;
};

export type LeverageQuote = {
  flashCollateralAmount: bigint;
  flashLoanAmount: bigint;
  totalAddedCollateral: bigint;
  isLoading: boolean;
  error: string | null;
};

/**
 * Converts user leverage intent into deterministic route amounts.
 *
 * - `flashCollateralAmount`: extra collateral target sourced via the flash leg
 * - `flashLoanAmount`: debt token flash amount needed to mint that extra collateral
 *
 * First-principles route semantics:
 * - ERC4626: multiplier applies to collateral shares, then `previewMint` quotes underlying debt assets.
 * - stETH/wstETH: multiplier applies to stETH-equivalent collateral exposure, then we map debt assets back to wstETH shares.
 */
export function useLeverageQuote({ chainId, route, userCollateralAmount, multiplierBps }: UseLeverageQuoteParams): LeverageQuote {
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

  const {
    data: userStEthAmount,
    isLoading: isLoadingUserStEthAmount,
    error: userStEthAmountError,
  } = useReadContract({
    address: route?.kind === 'steth' ? route.collateralToken : undefined,
    abi: wstEthAbi,
    functionName: 'getStETHByWstETH',
    args: [userCollateralAmount],
    chainId,
    query: {
      enabled: route?.kind === 'steth' && userCollateralAmount > 0n,
    },
  });

  const stEthFlashLoanAmount = useMemo(() => {
    if (route?.kind !== 'steth') return 0n;
    const stEthCollateralAmount = (userStEthAmount as bigint | undefined) ?? 0n;
    return computeFlashCollateralAmount(stEthCollateralAmount, multiplierBps);
  }, [route, userStEthAmount, multiplierBps]);

  const {
    data: wstEthByStEth,
    isLoading: isLoadingWstEthByStEth,
    error: wstEthByStEthError,
  } = useReadContract({
    address: route?.kind === 'steth' ? route.collateralToken : undefined,
    abi: wstEthAbi,
    functionName: 'getWstETHByStETH',
    args: [stEthFlashLoanAmount],
    chainId,
    query: {
      enabled: route?.kind === 'steth' && stEthFlashLoanAmount > 0n,
    },
  });

  const flashCollateralAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'erc4626') return targetFlashCollateralAmount;
    return (wstEthByStEth as bigint | undefined) ?? 0n;
  }, [route, targetFlashCollateralAmount, wstEthByStEth]);

  const flashLoanAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'erc4626') return (erc4626PreviewMint as bigint | undefined) ?? 0n;
    return stEthFlashLoanAmount;
  }, [route, erc4626PreviewMint, stEthFlashLoanAmount]);

  const error = useMemo(() => {
    if (!route) return null;
    const e = route.kind === 'erc4626' ? erc4626Error : (userStEthAmountError ?? wstEthByStEthError);
    if (!e) return null;
    return e instanceof Error ? e.message : 'Failed to quote leverage route';
  }, [route, erc4626Error, userStEthAmountError, wstEthByStEthError]);

  const isLoading =
    route?.kind === 'erc4626' ? isLoadingErc4626 : route?.kind === 'steth' ? isLoadingUserStEthAmount || isLoadingWstEthByStEth : false;

  return {
    flashCollateralAmount,
    flashLoanAmount,
    totalAddedCollateral: userCollateralAmount + flashCollateralAmount,
    isLoading,
    error,
  };
}

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
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
    address: route?.collateralVault,
    abi: erc4626Abi,
    functionName: 'previewMint',
    args: [targetFlashCollateralAmount],
    chainId,
    query: {
      enabled: !!route && targetFlashCollateralAmount > 0n,
    },
  });

  const flashCollateralAmount = useMemo(() => {
    if (!route) return 0n;
    return targetFlashCollateralAmount;
  }, [route, targetFlashCollateralAmount]);

  const flashLoanAmount = useMemo(() => {
    if (!route) return 0n;
    return (erc4626PreviewMint as bigint | undefined) ?? 0n;
  }, [route, erc4626PreviewMint]);

  const error = useMemo(() => {
    if (!route) return null;
    const e = erc4626Error;
    if (!e) return null;
    return e instanceof Error ? e.message : 'Failed to quote leverage route';
  }, [route, erc4626Error]);

  const isLoading = !!route && isLoadingErc4626;

  return {
    flashCollateralAmount,
    flashLoanAmount,
    totalAddedCollateral: userCollateralAmount + flashCollateralAmount,
    isLoading,
    error,
  };
}

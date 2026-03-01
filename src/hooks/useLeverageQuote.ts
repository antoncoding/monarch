import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { erc4626Abi } from '@/abis/erc4626';
import { fetchVeloraPriceRoute, type VeloraPriceRoute } from '@/features/swap/api/velora';
import { computeFlashCollateralAmount, computeLeveragedExtraAmount, withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

type UseLeverageQuoteParams = {
  chainId: number;
  route: LeverageRoute | null;
  userInputAmount: bigint;
  inputMode: 'collateral' | 'loan';
  multiplierBps: bigint;
  loanTokenAddress: string;
  loanTokenDecimals: number;
  collateralTokenAddress: string;
  collateralTokenDecimals: number;
  userAddress?: `0x${string}`;
};

export type LeverageQuote = {
  initialCollateralAmount: bigint;
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
  userInputAmount,
  inputMode,
  multiplierBps,
  loanTokenAddress,
  loanTokenDecimals,
  collateralTokenAddress,
  collateralTokenDecimals,
  userAddress,
}: UseLeverageQuoteParams): LeverageQuote {
  const isLoanAssetInput = inputMode === 'loan';
  const isSwapLoanAssetInput = route?.kind === 'swap' && isLoanAssetInput;
  const swapExecutionAddress = route?.kind === 'swap' ? route.paraswapAdapterAddress : null;

  const {
    data: erc4626PreviewDeposit,
    isLoading: isLoadingErc4626Deposit,
    error: erc4626DepositError,
  } = useReadContract({
    address: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewDeposit',
    args: [userInputAmount],
    chainId,
    query: {
      enabled: route?.kind === 'erc4626' && isLoanAssetInput && userInputAmount > 0n,
    },
  });

  const initialCollateralAmount = useMemo(() => {
    if (!route) return 0n;
    if (isSwapLoanAssetInput) return 0n;
    if (!isLoanAssetInput) return userInputAmount;
    if (route.kind === 'erc4626') return (erc4626PreviewDeposit as bigint | undefined) ?? 0n;
    return 0n;
  }, [route, isSwapLoanAssetInput, isLoanAssetInput, userInputAmount, erc4626PreviewDeposit]);

  const targetFlashCollateralAmount = useMemo(
    () => (isSwapLoanAssetInput ? 0n : computeFlashCollateralAmount(initialCollateralAmount, multiplierBps)),
    [isSwapLoanAssetInput, initialCollateralAmount, multiplierBps],
  );

  const {
    data: erc4626PreviewMint,
    isLoading: isLoadingErc4626Mint,
    error: erc4626MintError,
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

  const swapCollateralInputQuoteQuery = useQuery({
    queryKey: [
      'leverage-swap-collateral-input-quote',
      chainId,
      route?.kind === 'swap' ? route.paraswapAdapterAddress : null,
      route?.kind === 'swap' ? route.generalAdapterAddress : null,
      loanTokenAddress,
      loanTokenDecimals,
      collateralTokenAddress,
      collateralTokenDecimals,
      swapExecutionAddress,
      targetFlashCollateralAmount.toString(),
      userAddress ?? null,
    ],
    enabled: route?.kind === 'swap' && !isLoanAssetInput && targetFlashCollateralAmount > 0n && !!userAddress,
    queryFn: async () => {
      const buyRoute = await fetchVeloraPriceRoute({
        srcToken: loanTokenAddress,
        srcDecimals: loanTokenDecimals,
        destToken: collateralTokenAddress,
        destDecimals: collateralTokenDecimals,
        amount: targetFlashCollateralAmount,
        network: chainId,
        userAddress: swapExecutionAddress as `0x${string}`,
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
        userAddress: swapExecutionAddress as `0x${string}`,
        side: 'SELL',
      });
      if (BigInt(sellRoute.srcAmount) !== borrowAssets) {
        throw new Error('Failed to quote stable Velora swap route for leverage.');
      }

      return {
        flashLoanAmount: borrowAssets,
        flashCollateralAmount: withSlippageFloor(BigInt(sellRoute.destAmount)),
        priceRoute: sellRoute,
      };
    },
  });

  const swapLoanInputCombinedQuoteQuery = useQuery({
    queryKey: [
      'leverage-swap-loan-input-combined-quote',
      chainId,
      route?.kind === 'swap' ? route.paraswapAdapterAddress : null,
      route?.kind === 'swap' ? route.generalAdapterAddress : null,
      loanTokenAddress,
      loanTokenDecimals,
      collateralTokenAddress,
      collateralTokenDecimals,
      swapExecutionAddress,
      userInputAmount.toString(),
      multiplierBps.toString(),
      userAddress ?? null,
    ],
    enabled: route?.kind === 'swap' && isLoanAssetInput && userInputAmount > 0n && !!userAddress,
    queryFn: async () => {
      const flashLoanAmount = computeLeveragedExtraAmount(userInputAmount, multiplierBps);
      if (flashLoanAmount <= 0n) {
        return {
          flashLoanAmount: 0n,
          flashCollateralAmount: 0n,
          totalAddedCollateral: 0n,
          priceRoute: null,
        };
      }

      const totalLoanSellAmount = userInputAmount + flashLoanAmount;
      const sellRoute = await fetchVeloraPriceRoute({
        srcToken: loanTokenAddress,
        srcDecimals: loanTokenDecimals,
        destToken: collateralTokenAddress,
        destDecimals: collateralTokenDecimals,
        amount: totalLoanSellAmount,
        network: chainId,
        userAddress: swapExecutionAddress as `0x${string}`,
        side: 'SELL',
      });
      if (BigInt(sellRoute.srcAmount) !== totalLoanSellAmount) {
        throw new Error('Failed to quote stable Velora swap route for leverage.');
      }

      const totalAddedCollateral = withSlippageFloor(BigInt(sellRoute.destAmount));

      return {
        flashLoanAmount,
        flashCollateralAmount: 0n,
        totalAddedCollateral,
        priceRoute: sellRoute,
      };
    },
  });

  const flashCollateralAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') {
      if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.flashCollateralAmount ?? 0n;
      return swapCollateralInputQuoteQuery.data?.flashCollateralAmount ?? 0n;
    }
    return targetFlashCollateralAmount;
  }, [
    route,
    isLoanAssetInput,
    targetFlashCollateralAmount,
    swapLoanInputCombinedQuoteQuery.data?.flashCollateralAmount,
    swapCollateralInputQuoteQuery.data?.flashCollateralAmount,
  ]);

  const flashLoanAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') {
      if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.flashLoanAmount ?? 0n;
      return swapCollateralInputQuoteQuery.data?.flashLoanAmount ?? 0n;
    }
    return (erc4626PreviewMint as bigint | undefined) ?? 0n;
  }, [
    route,
    isLoanAssetInput,
    swapLoanInputCombinedQuoteQuery.data?.flashLoanAmount,
    swapCollateralInputQuoteQuery.data?.flashLoanAmount,
    erc4626PreviewMint,
  ]);

  const totalAddedCollateral = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') {
      if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.totalAddedCollateral ?? 0n;
      return initialCollateralAmount + flashCollateralAmount;
    }
    return initialCollateralAmount + flashCollateralAmount;
  }, [route, isLoanAssetInput, initialCollateralAmount, flashCollateralAmount, swapLoanInputCombinedQuoteQuery.data?.totalAddedCollateral]);

  const swapPriceRoute = useMemo(() => {
    if (route?.kind !== 'swap') return null;
    if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.priceRoute ?? null;
    return swapCollateralInputQuoteQuery.data?.priceRoute ?? null;
  }, [route, isLoanAssetInput, swapLoanInputCombinedQuoteQuery.data?.priceRoute, swapCollateralInputQuoteQuery.data?.priceRoute]);

  const error = useMemo(() => {
    if (!route) return null;
    if (route.kind === 'swap') {
      if (!userAddress && userInputAmount > 0n) return 'Connect wallet to fetch swap-backed leverage route.';
      const routeError = isLoanAssetInput ? swapLoanInputCombinedQuoteQuery.error : swapCollateralInputQuoteQuery.error;
      if (!routeError) return null;
      return routeError instanceof Error ? routeError.message : 'Failed to quote Velora swap route for leverage.';
    }
    const erc4626RouteError = erc4626DepositError ?? erc4626MintError;
    if (!erc4626RouteError) return null;
    return erc4626RouteError instanceof Error ? erc4626RouteError.message : 'Failed to quote leverage route';
  }, [
    route,
    swapExecutionAddress,
    userAddress,
    userInputAmount,
    isLoanAssetInput,
    swapLoanInputCombinedQuoteQuery.error,
    swapCollateralInputQuoteQuery.error,
    erc4626DepositError,
    erc4626MintError,
  ]);

  const isLoading =
    !!route &&
    (route.kind === 'swap'
      ? (isLoanAssetInput && (swapLoanInputCombinedQuoteQuery.isLoading || swapLoanInputCombinedQuoteQuery.isFetching)) ||
        (!isLoanAssetInput && (swapCollateralInputQuoteQuery.isLoading || swapCollateralInputQuoteQuery.isFetching))
      : isLoadingErc4626Deposit || isLoadingErc4626Mint);

  return {
    initialCollateralAmount,
    flashCollateralAmount,
    flashLoanAmount,
    totalAddedCollateral,
    isLoading,
    error,
    swapPriceRoute,
  };
}

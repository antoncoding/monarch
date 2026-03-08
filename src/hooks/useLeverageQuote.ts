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
  /**
   * Exact user-entered starting capital, denominated by `inputMode`.
   * - `loan`: market loan asset amount
   * - `collateral`: market collateral token amount
   */
  initialCapitalInputAmount: bigint;
  inputMode: 'collateral' | 'loan';
  slippageBps: number;
  multiplierBps: bigint;
  loanTokenAddress: string;
  loanTokenDecimals: number;
  collateralTokenAddress: string;
  collateralTokenDecimals: number;
  userAddress?: `0x${string}`;
};

export type LeverageQuote = {
  /**
   * Market collateral-token amount sourced directly from the user's starting capital before the flash leg.
   *
   * - collateral-input mode: equals `initialCapitalInputAmount`
   * - ERC4626 loan-input mode: `previewDeposit(initialCapitalInputAmount)`
   * - swap loan-input mode: `0n` because the user loan input is sold together with the flash leg
   */
  initialCapitalCollateralTokenAmount: bigint;
  /**
   * Additional market collateral-token amount sourced by the flash leg.
   *
   * - ERC4626 route: exact vault share amount minted in the callback
   * - swap route: minimum collateral output expected from selling the flash-borrowed loan asset
   */
  flashLegCollateralTokenAmount: bigint;
  /** Flash-loaned market loan-asset amount. */
  flashLoanAssetAmount: bigint;
  /** Total market collateral-token amount added before leverage fee. */
  totalCollateralTokenAmountAdded: bigint;
  isLoading: boolean;
  error: string | null;
  swapPriceRoute: VeloraPriceRoute | null;
};

/**
 * Converts user leverage intent into deterministic route amounts.
 *
 * - `flashLegCollateralTokenAmount`: extra market collateral-token amount sourced via the flash leg
 * - `flashLoanAssetAmount`: market loan-asset amount needed to source that extra collateral
 */
export function useLeverageQuote({
  chainId,
  route,
  initialCapitalInputAmount,
  inputMode,
  slippageBps,
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
    data: previewDepositCollateralSharesFromUserLoanAssets,
    isLoading: isLoadingErc4626Deposit,
    error: erc4626DepositError,
  } = useReadContract({
    address: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewDeposit',
    // `previewDeposit(user loan assets)` -> ERC4626 collateral shares minted from that exact asset input.
    args: [initialCapitalInputAmount],
    chainId,
    query: {
      enabled: route?.kind === 'erc4626' && isLoanAssetInput && initialCapitalInputAmount > 0n,
    },
  });

  const initialCapitalCollateralTokenAmount = useMemo(() => {
    if (!route) return 0n;
    if (isSwapLoanAssetInput) return 0n;
    if (!isLoanAssetInput) return initialCapitalInputAmount;
    // `previewDeposit(initialCapitalInputAmount)` returns the ERC4626 collateral-share amount minted by
    // depositing the user's exact loan-token asset input into the vault.
    if (route.kind === 'erc4626') return (previewDepositCollateralSharesFromUserLoanAssets as bigint | undefined) ?? 0n;
    return 0n;
  }, [route, isSwapLoanAssetInput, isLoanAssetInput, initialCapitalInputAmount, previewDepositCollateralSharesFromUserLoanAssets]);

  const targetFlashCollateralTokenAmount = useMemo(
    () => (isSwapLoanAssetInput ? 0n : computeFlashCollateralAmount(initialCapitalCollateralTokenAmount, multiplierBps)),
    [isSwapLoanAssetInput, initialCapitalCollateralTokenAmount, multiplierBps],
  );

  const {
    data: previewMintRequiredLoanAssetsForFlashCollateralShares,
    isLoading: isLoadingErc4626Mint,
    error: erc4626MintError,
  } = useReadContract({
    address: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewMint',
    // `previewMint(target flash collateral shares)` -> loan-token assets required to mint those exact shares.
    args: [targetFlashCollateralTokenAmount],
    chainId,
    query: {
      enabled: route?.kind === 'erc4626' && targetFlashCollateralTokenAmount > 0n,
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
      targetFlashCollateralTokenAmount.toString(),
      slippageBps,
      userAddress ?? null,
    ],
    enabled: route?.kind === 'swap' && !isLoanAssetInput && targetFlashCollateralTokenAmount > 0n && !!userAddress,
    queryFn: async () => {
      const buyRoute = await fetchVeloraPriceRoute({
        srcToken: loanTokenAddress,
        srcDecimals: loanTokenDecimals,
        destToken: collateralTokenAddress,
        destDecimals: collateralTokenDecimals,
        amount: targetFlashCollateralTokenAmount,
        network: chainId,
        userAddress: swapExecutionAddress as `0x${string}`,
        side: 'BUY',
      });

      const borrowAssets = BigInt(buyRoute.srcAmount);
      if (borrowAssets <= 0n) {
        return {
          flashLoanAssetAmount: 0n,
          flashLegCollateralTokenAmount: 0n,
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
        flashLoanAssetAmount: borrowAssets,
        flashLegCollateralTokenAmount: withSlippageFloor(BigInt(sellRoute.destAmount), slippageBps),
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
      initialCapitalInputAmount.toString(),
      multiplierBps.toString(),
      slippageBps,
      userAddress ?? null,
    ],
    enabled: route?.kind === 'swap' && isLoanAssetInput && initialCapitalInputAmount > 0n && !!userAddress,
    queryFn: async () => {
      const flashLoanAssetAmount = computeLeveragedExtraAmount(initialCapitalInputAmount, multiplierBps);
      if (flashLoanAssetAmount <= 0n) {
        return {
          flashLoanAssetAmount: 0n,
          flashLegCollateralTokenAmount: 0n,
          totalCollateralTokenAmountAdded: 0n,
          priceRoute: null,
        };
      }

      const totalLoanSellAmount = initialCapitalInputAmount + flashLoanAssetAmount;
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

      const totalCollateralTokenAmountAdded = withSlippageFloor(BigInt(sellRoute.destAmount), slippageBps);

      return {
        flashLoanAssetAmount,
        flashLegCollateralTokenAmount: 0n,
        totalCollateralTokenAmountAdded,
        priceRoute: sellRoute,
      };
    },
  });

  const flashLegCollateralTokenAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') {
      if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.flashLegCollateralTokenAmount ?? 0n;
      return swapCollateralInputQuoteQuery.data?.flashLegCollateralTokenAmount ?? 0n;
    }
    return targetFlashCollateralTokenAmount;
  }, [
    route,
    isLoanAssetInput,
    targetFlashCollateralTokenAmount,
    swapLoanInputCombinedQuoteQuery.data?.flashLegCollateralTokenAmount,
    swapCollateralInputQuoteQuery.data?.flashLegCollateralTokenAmount,
  ]);

  const flashLoanAssetAmount = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') {
      if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.flashLoanAssetAmount ?? 0n;
      return swapCollateralInputQuoteQuery.data?.flashLoanAssetAmount ?? 0n;
    }
    // `previewMint(targetFlashCollateralTokenAmount)` returns how many loan-token assets the flash leg
    // must source to mint that exact collateral-share amount.
    return (previewMintRequiredLoanAssetsForFlashCollateralShares as bigint | undefined) ?? 0n;
  }, [
    route,
    isLoanAssetInput,
    swapLoanInputCombinedQuoteQuery.data?.flashLoanAssetAmount,
    swapCollateralInputQuoteQuery.data?.flashLoanAssetAmount,
    previewMintRequiredLoanAssetsForFlashCollateralShares,
  ]);

  const totalCollateralTokenAmountAdded = useMemo(() => {
    if (!route) return 0n;
    if (route.kind === 'swap') {
      if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.totalCollateralTokenAmountAdded ?? 0n;
      return initialCapitalCollateralTokenAmount + flashLegCollateralTokenAmount;
    }
    return initialCapitalCollateralTokenAmount + flashLegCollateralTokenAmount;
  }, [
    route,
    isLoanAssetInput,
    initialCapitalCollateralTokenAmount,
    flashLegCollateralTokenAmount,
    swapLoanInputCombinedQuoteQuery.data?.totalCollateralTokenAmountAdded,
  ]);

  const swapPriceRoute = useMemo(() => {
    if (route?.kind !== 'swap') return null;
    if (isLoanAssetInput) return swapLoanInputCombinedQuoteQuery.data?.priceRoute ?? null;
    return swapCollateralInputQuoteQuery.data?.priceRoute ?? null;
  }, [route, isLoanAssetInput, swapLoanInputCombinedQuoteQuery.data?.priceRoute, swapCollateralInputQuoteQuery.data?.priceRoute]);

  const error = useMemo(() => {
    if (!route) return null;
    if (route.kind === 'swap') {
      if (!userAddress && initialCapitalInputAmount > 0n) return 'Connect wallet to fetch swap-backed leverage route.';
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
    initialCapitalInputAmount,
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
    initialCapitalCollateralTokenAmount,
    flashLegCollateralTokenAmount,
    flashLoanAssetAmount,
    totalCollateralTokenAmountAdded,
    isLoading,
    error,
    swapPriceRoute,
  };
}

import { useCallback, useMemo, useState } from 'react';
import { type Address, isAddress } from 'viem';
import { useConnection } from 'wagmi';
import { resolveErc4626RouteBundler } from '@/config/leverage';
import type { VeloraPriceRoute } from '@/features/swap/api/velora';
import { deleverageWithErc4626Redeem } from '@/hooks/deleverage/deleverageWithErc4626Redeem';
import { deleverageWithSwap } from '@/hooks/deleverage/deleverageWithSwap';
import type { DeleverageStepType } from '@/hooks/deleverage/transaction-shared';
import { buildMorphoMarketParams } from '@/hooks/leverage/transaction-shared';
import type { LeverageRoute } from '@/hooks/leverage/types';
import { useBundlerAuthorizationStep } from '@/hooks/useBundlerAuthorizationStep';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import type { Market } from '@/utils/types';

export type { DeleverageStepType } from '@/hooks/deleverage/transaction-shared';

type UseDeleverageTransactionProps = {
  autoWithdrawCollateralAmount: bigint;
  flashLoanAmount: bigint;
  market: Market;
  maxCollateralForDebtRepay: bigint;
  maxWithdrawCollateralAmount: bigint;
  onSuccess?: () => void;
  repayBySharesAmount: bigint;
  route: LeverageRoute | null;
  slippageBps: number;
  swapSellPriceRoute: VeloraPriceRoute | null;
  useCloseRoute: boolean;
  withdrawCollateralAmount: bigint;
};

/**
 * Executes deleverage transactions for:
 * - ERC4626 deterministic loops on Bundler V2
 * - generalized swap-backed loops on Bundler3 + adapters
 */
export function useDeleverageTransaction({
  autoWithdrawCollateralAmount,
  flashLoanAmount,
  market,
  maxCollateralForDebtRepay,
  maxWithdrawCollateralAmount,
  onSuccess,
  repayBySharesAmount,
  route,
  slippageBps,
  swapSellPriceRoute,
  useCloseRoute,
  withdrawCollateralAmount,
}: UseDeleverageTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const tracking = useTransactionTracking('deleverage');
  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const [executionError, setExecutionError] = useState<string | null>(null);
  const isSwapRoute = route?.kind === 'swap';
  const useSignatureAuthorization = usePermit2Setting && !isSwapRoute;
  const bundlerAddress = useMemo<Address | undefined>(() => {
    if (!route) return undefined;
    if (route.kind === 'swap') return route.bundler3Address;

    try {
      const resolvedBundler = resolveErc4626RouteBundler(market.morphoBlue.chain.id, market.uniqueKey);
      return isAddress(resolvedBundler) ? resolvedBundler : undefined;
    } catch {
      return undefined;
    }
  }, [route, market.uniqueKey, market.morphoBlue.chain.id]);
  const authorizationTarget = route?.kind === 'swap' ? route.generalAdapterAddress : bundlerAddress;
  const { batchAddUserMarkets } = useUserMarketsCache(account);

  const {
    isBundlerAuthorized,
    isBundlerAuthorizationReady,
    isBundlerAuthorizationStatusReady,
    isAuthorizingBundler,
    ensureBundlerAuthorization,
    refetchIsBundlerAuthorized,
  } = useBundlerAuthorizationStep({
    chainId: market.morphoBlue.chain.id,
    bundlerAddress: authorizationTarget as Address,
  });

  const { isConfirming: deleveragePending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'deleverage',
    pendingText: `Deleveraging ${formatBalance(withdrawCollateralAmount, market.collateralAsset.decimals)} ${market.collateralAsset.symbol}`,
    successText: 'Deleverage Executed',
    errorText: 'Failed to execute deleverage',
    chainId,
    pendingDescription: `Executing deleverage on market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: 'Position delevered successfully',
    onSuccess: () => {
      setExecutionError(null);
      void refetchIsBundlerAuthorized();
      if (onSuccess) void onSuccess();
    },
  });

  const getStepsForFlow = useCallback((isSignatureAuthorization: boolean, isSwap: boolean) => {
    if (isSwap) {
      return [
        {
          id: 'authorize_bundler_tx',
          title: 'Authorize Morpho Adapter',
          description: 'Submit one transaction authorizing adapter actions on your position.',
        },
        {
          id: 'execute',
          title: 'Confirm Deleverage',
          description: 'Confirm the deleverage transaction in your wallet.',
        },
      ];
    }

    if (isSignatureAuthorization) {
      return [
        {
          id: 'authorize_bundler_sig',
          title: 'Authorize Morpho Bundler',
          description: 'Sign a message to authorize deleverage actions.',
        },
        {
          id: 'execute',
          title: 'Confirm Deleverage',
          description: 'Confirm the deleverage transaction in your wallet.',
        },
      ];
    }

    return [
      {
        id: 'authorize_bundler_tx',
        title: 'Authorize Morpho Bundler',
        description: 'Submit one transaction authorizing bundler actions on your Morpho position.',
      },
      {
        id: 'execute',
        title: 'Confirm Deleverage',
        description: 'Confirm the deleverage transaction in your wallet.',
      },
    ];
  }, []);

  const executeDeleverage = useCallback(async () => {
    if (!account) {
      throw new Error('No account connected. Please connect your wallet.');
    }
    if (!route) {
      throw new Error('This market is not supported for deleverage.');
    }
    if (!bundlerAddress) {
      throw new Error('Deleverage route data is unavailable. Please refresh and try again.');
    }
    if (withdrawCollateralAmount <= 0n || flashLoanAmount <= 0n) {
      throw new Error('Invalid deleverage inputs. Set a collateral unwind amount above zero.');
    }
    if (withdrawCollateralAmount > maxWithdrawCollateralAmount) {
      throw new Error('Stale deleverage input. The maximum unwind amount changed. Please review and try again.');
    }
    if (useCloseRoute && repayBySharesAmount <= 0n) {
      throw new Error('Debt shares are unavailable for a full close. Refresh your position data and try again.');
    }

    const marketParams = buildMorphoMarketParams(market);

    if (route.kind === 'swap') {
      if (!swapSellPriceRoute) {
        throw new Error('Missing Velora swap quote for deleverage.');
      }

      await deleverageWithSwap({
        account,
        autoWithdrawCollateralAmount,
        bundlerAddress,
        ensureBundlerAuthorization,
        flashLoanAmount,
        isBundlerAuthorized,
        market,
        marketParams,
        maxCollateralForDebtRepay,
        repayBySharesAmount,
        route,
        sendTransactionAsync,
        slippageBps,
        swapSellPriceRoute,
        updateStep: tracking.update,
        useCloseRoute,
        withdrawCollateralAmount,
      });
      return;
    }

    await deleverageWithErc4626Redeem({
      account,
      autoWithdrawCollateralAmount,
      bundlerAddress,
      ensureBundlerAuthorization,
      flashLoanAmount,
      isBundlerAuthorized,
      market,
      marketParams,
      repayBySharesAmount,
      route,
      sendTransactionAsync,
      updateStep: tracking.update,
      useCloseRoute,
      useSignatureAuthorization,
      withdrawCollateralAmount,
    });
  }, [
    account,
    autoWithdrawCollateralAmount,
    bundlerAddress,
    ensureBundlerAuthorization,
    flashLoanAmount,
    isBundlerAuthorized,
    market,
    maxCollateralForDebtRepay,
    maxWithdrawCollateralAmount,
    repayBySharesAmount,
    route,
    sendTransactionAsync,
    slippageBps,
    swapSellPriceRoute,
    tracking.update,
    useCloseRoute,
    useSignatureAuthorization,
    withdrawCollateralAmount,
  ]);

  const clearExecutionError = useCallback(() => {
    setExecutionError(null);
  }, []);

  const authorizeAndDeleverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }
    if (!route || !bundlerAddress) {
      toast.info('Quote unavailable', 'Deleverage route data is unavailable. Please refresh and try again.');
      return;
    }
    if ((useSignatureAuthorization && !isBundlerAuthorizationReady) || (!useSignatureAuthorization && !isBundlerAuthorizationStatusReady)) {
      toast.info('Authorization status loading', 'Please wait a moment and try again.');
      return;
    }

    try {
      setExecutionError(null);
      const initialStep: DeleverageStepType = isBundlerAuthorized
        ? 'execute'
        : useSignatureAuthorization
          ? 'authorize_bundler_sig'
          : 'authorize_bundler_tx';
      tracking.start(
        getStepsForFlow(useSignatureAuthorization, isSwapRoute),
        {
          title: 'Deleverage',
          description: `${market.collateralAsset.symbol} unwound into ${market.loanAsset.symbol}`,
          tokenSymbol: market.collateralAsset.symbol,
          amount: withdrawCollateralAmount,
          marketId: market.uniqueKey,
        },
        initialStep,
      );

      await executeDeleverage();

      batchAddUserMarkets([
        {
          marketUniqueKey: market.uniqueKey,
          chainId: market.morphoBlue.chain.id,
        },
      ]);

      tracking.complete();
    } catch (error: unknown) {
      console.error('Error in authorizeAndDeleverage:', error);
      tracking.fail();
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'Failed to process deleverage transaction');
      setExecutionError(userFacingMessage === 'User rejected transaction.' ? null : userFacingMessage);
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Error', userFacingMessage);
      }
    }
  }, [
    account,
    batchAddUserMarkets,
    bundlerAddress,
    executeDeleverage,
    getStepsForFlow,
    isBundlerAuthorizationReady,
    isBundlerAuthorizationStatusReady,
    isBundlerAuthorized,
    isSwapRoute,
    market,
    route,
    toast,
    tracking,
    useSignatureAuthorization,
    withdrawCollateralAmount,
  ]);

  const isAuthorizationStatusLoading =
    (useSignatureAuthorization && !isBundlerAuthorizationReady) || (!useSignatureAuthorization && !isBundlerAuthorizationStatusReady);
  const isLoading = deleveragePending || isAuthorizingBundler || isAuthorizationStatusLoading;

  return {
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as DeleverageStepType | null,
    deleveragePending,
    isLoading,
    isBundlerAuthorized,
    executionError,
    clearExecutionError,
    authorizeAndDeleverage,
  };
}

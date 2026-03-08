import { useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import type { VeloraPriceRoute } from '@/features/swap/api/velora';
import { useConnection } from 'wagmi';
import { getLeverageFee } from '@/config/fees';
import { resolveErc4626RouteBundler } from '@/config/leverage';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { useBundlerAuthorizationStep } from '@/hooks/useBundlerAuthorizationStep';
import { usePermit2 } from '@/hooks/usePermit2';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { leverageWithErc4626Deposit } from '@/hooks/leverage/leverageWithErc4626Deposit';
import { leverageWithSwap } from '@/hooks/leverage/leverageWithSwap';
import { buildLeverageMarketParams, type LeverageStepType } from '@/hooks/leverage/transaction-shared';
import type { LeverageRoute } from '@/hooks/leverage/types';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import type { Market } from '@/utils/types';

export type { LeverageStepType } from '@/hooks/leverage/transaction-shared';

type UseLeverageTransactionProps = {
  market: Market;
  route: LeverageRoute | null;
  collateralAmount: bigint;
  collateralAmountInCollateralToken: bigint;
  flashCollateralAmount: bigint;
  flashLoanAmount: bigint;
  totalAddedCollateral: bigint;
  collateralAssetPriceUsd: number | null;
  swapPriceRoute: VeloraPriceRoute | null;
  slippageBps: number;
  useLoanAssetAsInput: boolean;
  onSuccess?: () => void;
};

/**
 * Executes leverage transactions for:
 * - ERC4626 deterministic loops on Bundler V2
 * - generalized swap-backed loops on Bundler3 + adapters
 */
export function useLeverageTransaction({
  market,
  route,
  collateralAmount,
  collateralAmountInCollateralToken,
  flashCollateralAmount,
  flashLoanAmount,
  totalAddedCollateral,
  collateralAssetPriceUsd,
  swapPriceRoute,
  slippageBps,
  useLoanAssetAsInput,
  onSuccess,
}: UseLeverageTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const tracking = useTransactionTracking('leverage');
  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const isSwapRoute = route?.kind === 'swap';
  const usePermit2ForRoute = usePermit2Setting;

  const bundlerAddress = useMemo<Address>(() => {
    if (route?.kind === 'swap') {
      return route.bundler3Address;
    }

    return resolveErc4626RouteBundler(market.morphoBlue.chain.id, market.uniqueKey);
  }, [route, market.uniqueKey, market.morphoBlue.chain.id]);
  const authorizationTarget = useMemo<Address>(() => {
    if (route?.kind === 'swap') {
      return route.generalAdapterAddress;
    }

    return bundlerAddress;
  }, [route, bundlerAddress]);

  const { batchAddUserMarkets } = useUserMarketsCache(account);
  const isLoanAssetInput = useLoanAssetAsInput;
  const inputTokenAddress = isLoanAssetInput ? (market.loanAsset.address as Address) : (market.collateralAsset.address as Address);
  const inputTokenSymbol = isLoanAssetInput ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const inputTokenDecimals = isLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputTokenAmountForTransfer = isLoanAssetInput ? collateralAmount : collateralAmountInCollateralToken;
  const approvalSpender = route?.kind === 'swap' ? route.generalAdapterAddress : bundlerAddress;

  const {
    isBundlerAuthorized,
    isBundlerAuthorizationStatusReady,
    isBundlerAuthorizationReady,
    isAuthorizingBundler,
    ensureBundlerAuthorization,
    refetchIsBundlerAuthorized,
  } = useBundlerAuthorizationStep({
    chainId: market.morphoBlue.chain.id,
    bundlerAddress: authorizationTarget,
  });

  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: approvalSpender,
    token: inputTokenAddress as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: inputTokenSymbol,
    amount: usePermit2ForRoute ? inputTokenAmountForTransfer : 0n,
  });
  const isAuthorizationReadyForRoute = usePermit2ForRoute ? isBundlerAuthorizationReady : isBundlerAuthorizationStatusReady;

  const { isApproved, approve, isApproving } = useERC20Approval({
    token: inputTokenAddress,
    spender: approvalSpender,
    amount: inputTokenAmountForTransfer,
    tokenSymbol: inputTokenSymbol,
    chainId: market.morphoBlue.chain.id,
  });

  const { isConfirming: leveragePending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'leverage',
    pendingText: `Leveraging ${formatBalance(collateralAmount, inputTokenDecimals)} ${inputTokenSymbol}`,
    successText: 'Leverage Executed',
    errorText: 'Failed to execute leverage',
    chainId,
    pendingDescription: `Executing leverage on market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: 'Position levered successfully',
    onSuccess: () => {
      void refetchIsBundlerAuthorized();
      if (onSuccess) void onSuccess();
    },
  });
  const trackingMetadata = useMemo(
    () => ({
      title: 'Leverage',
      description: `${market.collateralAsset.symbol} leveraged using ${market.loanAsset.symbol} debt`,
      tokenSymbol: inputTokenSymbol,
      amount: collateralAmount,
      marketId: market.uniqueKey,
    }),
    [market.collateralAsset.symbol, market.loanAsset.symbol, inputTokenSymbol, collateralAmount, market.uniqueKey],
  );

  const getStepsForFlow = useCallback(
    (isPermit2: boolean, isSwap: boolean) => {
      if (isSwap && isPermit2) {
        return [
          {
            id: 'approve_permit2',
            title: 'Authorize Permit2',
            description: "One-time approval so future leverage transactions don't need token approvals.",
          },
          {
            id: 'authorize_bundler_sig',
            title: 'Authorize Morpho Adapter',
            description: 'Sign a message authorizing the Morpho general adapter for this leverage flow.',
          },
          {
            id: 'sign_permit',
            title: 'Sign Token Permit',
            description: 'Sign Permit2 transfer authorization for the general adapter.',
          },
          {
            id: 'execute',
            title: 'Confirm Leverage',
            description: 'Confirm the leverage transaction in your wallet.',
          },
        ];
      }

      if (isSwap) {
        return [
          {
            id: 'authorize_bundler_tx',
            title: 'Authorize Morpho Adapter',
            description: 'Submit one transaction authorizing Morpho adapter actions on your position.',
          },
          {
            id: 'approve_token',
            title: `Approve ${inputTokenSymbol}`,
            description: `Approve ${inputTokenSymbol} transfer for the leverage flow.`,
          },
          {
            id: 'execute',
            title: 'Confirm Leverage',
            description: 'Confirm the leverage transaction in your wallet.',
          },
        ];
      }

      if (isPermit2) {
        return [
          {
            id: 'approve_permit2',
            title: 'Authorize Permit2',
            description: "One-time approval so future leverage transactions don't need token approvals.",
          },
          {
            id: 'authorize_bundler_sig',
            title: 'Authorize Morpho Bundler',
            description: 'Sign a message to authorize the bundler for Morpho actions.',
          },
          {
            id: 'sign_permit',
            title: 'Sign Token Permit',
            description: 'Sign Permit2 transfer authorization for collateral transfer.',
          },
          {
            id: 'execute',
            title: 'Confirm Leverage',
            description: 'Confirm the leverage transaction in your wallet.',
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
          id: 'approve_token',
          title: `Approve ${inputTokenSymbol}`,
          description: `Approve ${inputTokenSymbol} transfer for the leverage flow.`,
        },
        {
          id: 'execute',
          title: 'Confirm Leverage',
          description: 'Confirm the leverage transaction in your wallet.',
        },
      ];
    },
    [inputTokenSymbol],
  );

  const executeLeverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    if (!route) {
      toast.info('Unsupported route', 'This market is not supported for leverage.');
      return;
    }

    const hasCollateralOutput = route.kind === 'swap' && isLoanAssetInput ? totalAddedCollateral > 0n : flashCollateralAmount > 0n;
    if (collateralAmount <= 0n || flashLoanAmount <= 0n || !hasCollateralOutput) {
      toast.info('Invalid leverage inputs', 'Set collateral and multiplier above 1x before submitting.');
      return;
    }
    if (collateralAssetPriceUsd == null || !Number.isFinite(collateralAssetPriceUsd) || collateralAssetPriceUsd <= 0) {
      toast.info('Leverage unavailable', 'Collateral price unavailable for fee calculation.');
      return;
    }

    const leverageFeeAmount = getLeverageFee({
      amount: totalAddedCollateral,
      assetPriceUsd: collateralAssetPriceUsd,
      assetDecimals: market.collateralAsset.decimals,
    });
    if (totalAddedCollateral - leverageFeeAmount <= 0n) {
      toast.info('Leverage unavailable', 'Net collateral after fee must be positive.');
      return;
    }

    try {
      const marketParams = buildLeverageMarketParams(market);

      if (route.kind === 'swap') {
        if (!swapPriceRoute) {
          throw new Error('Missing Velora swap quote for leverage.');
        }

        await leverageWithSwap({
          account: account as Address,
          bundlerAddress,
          market,
          marketParams,
          route,
          inputTokenAddress,
          inputTokenAmountForTransfer,
          isLoanAssetInput,
          flashLoanAmount,
          flashCollateralAmount,
          totalAddedCollateral,
          leverageFeeAmount,
          swapPriceRoute,
          slippageBps,
          usePermit2: usePermit2ForRoute,
          permit2Authorized,
          isBundlerAuthorized,
          authorizePermit2,
          ensureBundlerAuthorization,
          signForBundlers,
          isApproved,
          approve,
          updateStep: tracking.update,
          sendTransactionAsync,
        });
      } else {
        await leverageWithErc4626Deposit({
          account: account as Address,
          bundlerAddress,
          market,
          marketParams,
          route,
          collateralAmount,
          collateralAmountInCollateralToken,
          inputTokenAddress,
          inputTokenAmountForTransfer,
          isLoanAssetInput,
          flashCollateralAmount,
          flashLoanAmount,
          leverageFeeAmount,
          usePermit2: usePermit2ForRoute,
          permit2Authorized,
          isBundlerAuthorized,
          authorizePermit2,
          ensureBundlerAuthorization,
          signForBundlers,
          isApproved,
          approve,
          updateStep: tracking.update,
          sendTransactionAsync,
        });
      }

      batchAddUserMarkets([
        {
          marketUniqueKey: market.uniqueKey,
          chainId: market.morphoBlue.chain.id,
        },
      ]);

      tracking.complete();
    } catch (error: unknown) {
      tracking.fail();
      console.error('Error during leverage execution:', error);
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'An unexpected error occurred during leverage.');
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Leverage Failed', userFacingMessage);
      }
    }
  }, [
    account,
    route,
    market,
    collateralAmount,
    collateralAmountInCollateralToken,
    inputTokenAddress,
    inputTokenAmountForTransfer,
    isLoanAssetInput,
    flashCollateralAmount,
    flashLoanAmount,
    totalAddedCollateral,
    collateralAssetPriceUsd,
    swapPriceRoute,
    slippageBps,
    usePermit2ForRoute,
    permit2Authorized,
    isBundlerAuthorized,
    authorizePermit2,
    ensureBundlerAuthorization,
    signForBundlers,
    isApproved,
    approve,
    bundlerAddress,
    sendTransactionAsync,
    batchAddUserMarkets,
    tracking,
    toast,
  ]);

  const runLeverageFlow = useCallback(
    async ({
      initialStep,
      usePermit2Flow,
      errorTitle,
      logLabel,
    }: {
      initialStep: LeverageStepType;
      usePermit2Flow: boolean;
      errorTitle: string;
      logLabel: string;
    }) => {
      if (!account) {
        toast.info('No account connected', 'Please connect your wallet.');
        return;
      }

      try {
        tracking.start(getStepsForFlow(usePermit2Flow, isSwapRoute), trackingMetadata, initialStep);
        await executeLeverage();
      } catch (error: unknown) {
        console.error(`Error in ${logLabel}:`, error);
        tracking.fail();
        const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'Failed to process leverage transaction');
        if (userFacingMessage !== 'User rejected transaction.') {
          toast.error(errorTitle, userFacingMessage);
        }
      }
    },
    [account, tracking, getStepsForFlow, isSwapRoute, trackingMetadata, executeLeverage, toast],
  );

  const approveAndLeverage = useCallback(async () => {
    const initialStep: LeverageStepType = usePermit2ForRoute
      ? permit2Authorized
        ? isBundlerAuthorized
          ? 'sign_permit'
          : 'authorize_bundler_sig'
        : 'approve_permit2'
      : isBundlerAuthorized
        ? isApproved
          ? 'execute'
          : 'approve_token'
        : 'authorize_bundler_tx';

    await runLeverageFlow({
      initialStep,
      usePermit2Flow: usePermit2ForRoute,
      errorTitle: 'Error',
      logLabel: 'approveAndLeverage',
    });
  }, [usePermit2ForRoute, permit2Authorized, isBundlerAuthorized, isApproved, runLeverageFlow]);

  const signAndLeverage = useCallback(async () => {
    if (!usePermit2ForRoute) {
      await approveAndLeverage();
      return;
    }

    const initialStep: LeverageStepType = permit2Authorized
      ? isBundlerAuthorized
        ? 'sign_permit'
        : 'authorize_bundler_sig'
      : 'approve_permit2';

    await runLeverageFlow({
      initialStep,
      usePermit2Flow: true,
      errorTitle: 'Transaction Error',
      logLabel: 'signAndLeverage',
    });
  }, [usePermit2ForRoute, approveAndLeverage, permit2Authorized, isBundlerAuthorized, runLeverageFlow]);

  const isLoading =
    leveragePending || (usePermit2ForRoute && isLoadingPermit2) || !isAuthorizationReadyForRoute || isApproving || isAuthorizingBundler;

  return {
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as LeverageStepType | null,
    isLoadingPermit2: usePermit2ForRoute ? isLoadingPermit2 : false,
    isApproved,
    permit2Authorized: usePermit2ForRoute ? permit2Authorized : false,
    leveragePending,
    isLoading,
    isBundlerAuthorized,
    isBundlerAuthorizationReady: isAuthorizationReadyForRoute,
    approveAndLeverage,
    signAndLeverage,
  };
}

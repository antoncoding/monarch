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
import { buildMorphoMarketParams, type LeverageStepType } from '@/hooks/leverage/transaction-shared';
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
  /** Exact user-entered starting capital, denominated by `useLoanAssetInput`. */
  initialCapitalInputAmount: bigint;
  /** Market collateral-token amount sourced from the initial capital before the flash leg. */
  initialCapitalCollateralTokenAmount: bigint;
  /** Market collateral-token amount added by the flash leg. */
  flashLegCollateralTokenAmount: bigint;
  /** Flash-loaned market loan-asset amount. */
  flashLoanAssetAmount: bigint;
  /** Total market collateral-token amount added before leverage fee. */
  totalCollateralTokenAmountAdded: bigint;
  collateralAssetPriceUsd: number | null;
  swapPriceRoute: VeloraPriceRoute | null;
  slippageBps: number;
  useLoanAssetInput: boolean;
  onSuccess?: () => void;
};

type LeverageExecutionPreflight =
  | {
      account: Address;
      leverageFeeAmount: bigint;
      route: Extract<LeverageRoute, { kind: 'swap' }>;
      swapPriceRoute: VeloraPriceRoute;
    }
  | {
      account: Address;
      leverageFeeAmount: bigint;
      route: Extract<LeverageRoute, { kind: 'erc4626' }>;
      swapPriceRoute: null;
    };

/**
 * Executes leverage transactions for:
 * - ERC4626 deterministic loops on Bundler V2
 * - generalized swap-backed loops on Bundler3 + adapters
 */
export function useLeverageTransaction({
  market,
  route,
  initialCapitalInputAmount,
  initialCapitalCollateralTokenAmount,
  flashLegCollateralTokenAmount,
  flashLoanAssetAmount,
  totalCollateralTokenAmountAdded,
  collateralAssetPriceUsd,
  swapPriceRoute,
  slippageBps,
  useLoanAssetInput,
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
  const initialCapitalUsesLoanAsset = useLoanAssetInput;
  const initialCapitalInputTokenAddress = initialCapitalUsesLoanAsset
    ? (market.loanAsset.address as Address)
    : (market.collateralAsset.address as Address);
  const initialCapitalInputTokenSymbol = initialCapitalUsesLoanAsset ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const initialCapitalInputTokenDecimals = initialCapitalUsesLoanAsset ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const initialCapitalTransferAmount = initialCapitalUsesLoanAsset ? initialCapitalInputAmount : initialCapitalCollateralTokenAmount;
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
    token: initialCapitalInputTokenAddress as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: initialCapitalInputTokenSymbol,
    amount: usePermit2ForRoute ? initialCapitalTransferAmount : 0n,
  });
  const isAuthorizationReadyForRoute = usePermit2ForRoute ? isBundlerAuthorizationReady : isBundlerAuthorizationStatusReady;

  const { isApproved, approve, isApproving } = useERC20Approval({
    token: initialCapitalInputTokenAddress,
    spender: approvalSpender,
    amount: initialCapitalTransferAmount,
    tokenSymbol: initialCapitalInputTokenSymbol,
    chainId: market.morphoBlue.chain.id,
  });

  const { isConfirming: leveragePending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'leverage',
    pendingText: `Leveraging ${formatBalance(initialCapitalInputAmount, initialCapitalInputTokenDecimals)} ${initialCapitalInputTokenSymbol}`,
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
      tokenSymbol: initialCapitalInputTokenSymbol,
      amount: initialCapitalInputAmount,
      marketId: market.uniqueKey,
    }),
    [market.collateralAsset.symbol, market.loanAsset.symbol, initialCapitalInputTokenSymbol, initialCapitalInputAmount, market.uniqueKey],
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
            title: `Approve ${initialCapitalInputTokenSymbol}`,
            description: `Approve ${initialCapitalInputTokenSymbol} transfer for the leverage flow.`,
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
            description: `Sign Permit2 transfer authorization for ${initialCapitalInputTokenSymbol}.`,
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
          title: `Approve ${initialCapitalInputTokenSymbol}`,
          description: `Approve ${initialCapitalInputTokenSymbol} transfer for the leverage flow.`,
        },
        {
          id: 'execute',
          title: 'Confirm Leverage',
          description: 'Confirm the leverage transaction in your wallet.',
        },
      ];
    },
    [initialCapitalInputTokenSymbol],
  );

  const getLeverageExecutionPreflight = useCallback((): LeverageExecutionPreflight | null => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return null;
    }

    if (!route) {
      toast.info('Unsupported route', 'This market is not supported for leverage.');
      return null;
    }

    const hasCollateralOutput =
      route.kind === 'swap' && initialCapitalUsesLoanAsset ? totalCollateralTokenAmountAdded > 0n : flashLegCollateralTokenAmount > 0n;
    if (initialCapitalInputAmount <= 0n || flashLoanAssetAmount <= 0n || !hasCollateralOutput) {
      toast.info('Invalid leverage inputs', 'Set initial capital and multiplier above 1x before submitting.');
      return null;
    }
    if (collateralAssetPriceUsd == null || !Number.isFinite(collateralAssetPriceUsd) || collateralAssetPriceUsd <= 0) {
      toast.info('Leverage unavailable', 'Collateral price unavailable for fee calculation.');
      return null;
    }

    const leverageFeeAmount = getLeverageFee({
      amount: totalCollateralTokenAmountAdded,
      assetPriceUsd: collateralAssetPriceUsd,
      assetDecimals: market.collateralAsset.decimals,
    });
    if (totalCollateralTokenAmountAdded - leverageFeeAmount <= 0n) {
      toast.info('Leverage unavailable', 'Net collateral after fee must be positive.');
      return null;
    }

    if (route.kind === 'swap') {
      if (!swapPriceRoute) {
        toast.info('Quote unavailable', 'Missing swap quote for leverage. Refresh the preview and try again.');
        return null;
      }

      return {
        account: account as Address,
        leverageFeeAmount,
        route,
        swapPriceRoute,
      };
    }

    return {
      account: account as Address,
      leverageFeeAmount,
      route,
      swapPriceRoute: null,
    };
  }, [
    account,
    route,
    initialCapitalUsesLoanAsset,
    totalCollateralTokenAmountAdded,
    flashLegCollateralTokenAmount,
    initialCapitalInputAmount,
    flashLoanAssetAmount,
    collateralAssetPriceUsd,
    market.collateralAsset.decimals,
    swapPriceRoute,
    toast,
  ]);

  const executeLeverage = useCallback(
    async (
      execution: LeverageExecutionPreflight & {
        updateStep: (step: LeverageStepType) => void;
      },
    ) => {
      const marketParams = buildMorphoMarketParams(market);

      if (execution.route.kind === 'swap') {
        const swapExecutionPriceRoute = execution.swapPriceRoute;
        if (!swapExecutionPriceRoute) {
          throw new Error('Missing Velora swap quote for leverage.');
        }

        await leverageWithSwap({
          account: execution.account,
          bundlerAddress,
          market,
          marketParams,
          route: execution.route,
          initialCapitalInputTokenAddress,
          initialCapitalTransferAmount,
          isLoanAssetInput: initialCapitalUsesLoanAsset,
          flashLoanAssetAmount,
          flashLegCollateralTokenAmount,
          totalCollateralTokenAmountAdded,
          leverageFeeAmount: execution.leverageFeeAmount,
          swapPriceRoute: swapExecutionPriceRoute,
          slippageBps,
          usePermit2: usePermit2ForRoute,
          permit2Authorized,
          isBundlerAuthorized,
          authorizePermit2,
          ensureBundlerAuthorization,
          signForBundlers,
          isApproved,
          approve,
          updateStep: execution.updateStep,
          sendTransactionAsync,
        });
      } else {
        await leverageWithErc4626Deposit({
          account: execution.account,
          bundlerAddress,
          market,
          marketParams,
          route: execution.route,
          initialCapitalInputAmount,
          initialCapitalCollateralTokenAmount,
          initialCapitalInputTokenAddress,
          initialCapitalTransferAmount,
          isLoanAssetInput: initialCapitalUsesLoanAsset,
          flashLegCollateralTokenAmount,
          flashLoanAssetAmount,
          leverageFeeAmount: execution.leverageFeeAmount,
          usePermit2: usePermit2ForRoute,
          permit2Authorized,
          isBundlerAuthorized,
          authorizePermit2,
          ensureBundlerAuthorization,
          signForBundlers,
          isApproved,
          approve,
          updateStep: execution.updateStep,
          sendTransactionAsync,
        });
      }
    },
    [
      market,
      bundlerAddress,
      initialCapitalInputAmount,
      initialCapitalCollateralTokenAmount,
      initialCapitalInputTokenAddress,
      initialCapitalTransferAmount,
      initialCapitalUsesLoanAsset,
      flashLoanAssetAmount,
      flashLegCollateralTokenAmount,
      totalCollateralTokenAmountAdded,
      slippageBps,
      usePermit2ForRoute,
      permit2Authorized,
      isBundlerAuthorized,
      authorizePermit2,
      ensureBundlerAuthorization,
      signForBundlers,
      isApproved,
      approve,
      sendTransactionAsync,
    ],
  );

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
      const preflight = getLeverageExecutionPreflight();
      if (!preflight) {
        return;
      }

      const steps = getStepsForFlow(usePermit2Flow, isSwapRoute);
      const stepIndexes = new Map(steps.map((step, index) => [step.id, index]));
      let highestStepIndex = stepIndexes.get(initialStep) ?? -1;
      const updateTrackedStep = (step: LeverageStepType) => {
        const nextIndex = stepIndexes.get(step) ?? -1;
        if (nextIndex > highestStepIndex) {
          highestStepIndex = nextIndex;
          tracking.update(step);
        }
      };

      try {
        tracking.start(steps, trackingMetadata, initialStep);
        await executeLeverage({
          ...preflight,
          updateStep: updateTrackedStep,
        });

        batchAddUserMarkets([
          {
            marketUniqueKey: market.uniqueKey,
            chainId: market.morphoBlue.chain.id,
          },
        ]);

        tracking.complete();
      } catch (error: unknown) {
        console.error(`Error in ${logLabel}:`, error);
        tracking.fail();
        const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'Failed to process leverage transaction');
        if (userFacingMessage !== 'User rejected transaction.') {
          toast.error(errorTitle, userFacingMessage);
        }
      }
    },
    [
      getLeverageExecutionPreflight,
      getStepsForFlow,
      isSwapRoute,
      trackingMetadata,
      executeLeverage,
      batchAddUserMarkets,
      market.uniqueKey,
      market.morphoBlue.chain.id,
      tracking,
      toast,
    ],
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

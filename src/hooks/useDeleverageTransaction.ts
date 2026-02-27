import { useCallback } from 'react';
import { type Address, encodeAbiParameters, encodeFunctionData } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useBundlerAuthorizationStep } from '@/hooks/useBundlerAuthorizationStep';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

export type DeleverageStepType = 'authorize_bundler_sig' | 'authorize_bundler_tx' | 'execute';

type UseDeleverageTransactionProps = {
  market: Market;
  route: LeverageRoute | null;
  withdrawCollateralAmount: bigint;
  flashLoanAmount: bigint;
  repayBySharesAmount: bigint;
  autoWithdrawCollateralAmount: bigint;
  onSuccess?: () => void;
};

/**
 * Executes V2 deleverage for deterministic conversion routes.
 *
 * Flow:
 * 1) flash-loan debt token
 * 2) repay debt on behalf of user
 * 3) withdraw requested collateral
 * 4) convert withdrawn collateral back into debt token
 *
 * Morpho pulls the flash-loaned debt token back from bundler after callback.
 */
export function useDeleverageTransaction({
  market,
  route,
  withdrawCollateralAmount,
  flashLoanAmount,
  repayBySharesAmount,
  autoWithdrawCollateralAmount,
  onSuccess,
}: UseDeleverageTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const tracking = useTransactionTracking('deleverage');
  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const bundlerAddress = getBundlerV2(market.morphoBlue.chain.id);
  const { batchAddUserMarkets } = useUserMarketsCache(account);

  const { isBundlerAuthorized, isAuthorizingBundler, ensureBundlerAuthorization, refetchIsBundlerAuthorized } = useBundlerAuthorizationStep(
    {
      chainId: market.morphoBlue.chain.id,
      bundlerAddress: bundlerAddress as Address,
    },
  );

  const { isConfirming: deleveragePending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'deleverage',
    pendingText: `Deleveraging ${formatBalance(withdrawCollateralAmount, market.collateralAsset.decimals)} ${market.collateralAsset.symbol}`,
    successText: 'Deleverage Executed',
    errorText: 'Failed to execute deleverage',
    chainId,
    pendingDescription: `Executing deleverage on market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: 'Position delevered successfully',
    onSuccess: () => {
      void refetchIsBundlerAuthorized();
      if (onSuccess) void onSuccess();
    },
  });

  const getStepsForFlow = useCallback((isPermit2: boolean) => {
    if (isPermit2) {
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
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    if (!route) {
      toast.info('Unsupported route', 'This market is not supported for deleverage.');
      return;
    }

    if (withdrawCollateralAmount <= 0n || flashLoanAmount <= 0n) {
      toast.info('Invalid deleverage inputs', 'Set a collateral unwind amount above zero.');
      return;
    }

    try {
      const txs: `0x${string}`[] = [];

      if (usePermit2Setting) {
        tracking.update('authorize_bundler_sig');
        const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
        if (authorizationTxData) {
          txs.push(authorizationTxData);
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      } else {
        tracking.update('authorize_bundler_tx');
        const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
        if (!authorized) {
          throw new Error('Failed to authorize Bundler via transaction.');
        }
      }

      const isRepayByShares = repayBySharesAmount > 0n;
      // WHY: when repaying by assets, Morpho expects a *minimum* shares bound.
      // Using an upper-bound style estimate causes false "slippage exceeded" reverts.
      const minRepayShares = 1n;

      const callbackTxs: `0x${string}`[] = [
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoRepay',
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            isRepayByShares ? 0n : flashLoanAmount,
            isRepayByShares ? repayBySharesAmount : 0n,
            isRepayByShares ? flashLoanAmount : minRepayShares,
            account as Address,
            '0x',
          ],
        }),
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoWithdrawCollateral',
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            withdrawCollateralAmount,
            bundlerAddress as Address,
          ],
        }),
      ];

      const minAssetsOut = withSlippageFloor(flashLoanAmount);
      callbackTxs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'erc4626Redeem',
          args: [route.collateralVault, withdrawCollateralAmount, minAssetsOut, bundlerAddress as Address, bundlerAddress as Address],
        }),
      );

      if (autoWithdrawCollateralAmount > 0n) {
        // WHY: if deleverage fully clears debt, keeping collateral locked in Morpho adds friction.
        // We withdraw the remaining collateral in the same transaction so the position is closed.
        callbackTxs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoWithdrawCollateral',
            args: [
              {
                loanToken: market.loanAsset.address as Address,
                collateralToken: market.collateralAsset.address as Address,
                oracle: market.oracleAddress as Address,
                irm: market.irmAddress as Address,
                lltv: BigInt(market.lltv),
              },
              autoWithdrawCollateralAmount,
              account as Address,
            ],
          }),
        );
      }

      const flashLoanCallbackData = encodeAbiParameters([{ type: 'bytes[]' }], [callbackTxs]);
      txs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoFlashLoan',
          args: [market.loanAsset.address as Address, flashLoanAmount, flashLoanCallbackData],
        }),
      );

      tracking.update('execute');
      await new Promise((resolve) => setTimeout(resolve, 700));

      await sendTransactionAsync({
        account,
        to: bundlerAddress,
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
        value: 0n,
      });

      batchAddUserMarkets([
        {
          marketUniqueKey: market.uniqueKey,
          chainId: market.morphoBlue.chain.id,
        },
      ]);

      tracking.complete();
    } catch (error: unknown) {
      tracking.fail();
      console.error('Error during deleverage execution:', error);
      if (error instanceof Error && !error.message.toLowerCase().includes('rejected')) {
        toast.error('Deleverage Failed', 'An unexpected error occurred during deleverage.');
      }
    }
  }, [
    account,
    market,
    route,
    withdrawCollateralAmount,
    flashLoanAmount,
    repayBySharesAmount,
    autoWithdrawCollateralAmount,
    usePermit2Setting,
    ensureBundlerAuthorization,
    bundlerAddress,
    sendTransactionAsync,
    batchAddUserMarkets,
    tracking,
    toast,
  ]);

  const authorizeAndDeleverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    try {
      const initialStep = usePermit2Setting ? 'authorize_bundler_sig' : 'authorize_bundler_tx';
      tracking.start(
        getStepsForFlow(usePermit2Setting),
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
    } catch (error: unknown) {
      console.error('Error in authorizeAndDeleverage:', error);
      tracking.fail();
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Error', 'Failed to process deleverage transaction');
        }
      } else {
        toast.error('Error', 'An unexpected error occurred');
      }
    }
  }, [account, usePermit2Setting, tracking, getStepsForFlow, market, withdrawCollateralAmount, executeDeleverage, toast]);

  const isLoading = deleveragePending || isAuthorizingBundler;

  return {
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as DeleverageStepType | null,
    deleveragePending,
    isLoading,
    isBundlerAuthorized,
    authorizeAndDeleverage,
  };
}

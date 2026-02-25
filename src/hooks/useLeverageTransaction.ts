import { useCallback } from 'react';
import { type Address, encodeAbiParameters, encodeFunctionData, maxUint256 } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { useBundlerAuthorizationStep } from '@/hooks/useBundlerAuthorizationStep';
import { usePermit2 } from '@/hooks/usePermit2';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { computeBorrowSharesWithBuffer, withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

export type LeverageStepType =
  | 'approve_permit2'
  | 'authorize_bundler_sig'
  | 'sign_permit'
  | 'authorize_bundler_tx'
  | 'approve_token'
  | 'execute';

type UseLeverageTransactionProps = {
  market: Market;
  route: LeverageRoute;
  collateralAmount: bigint;
  collateralAmountInCollateralToken: bigint;
  flashCollateralAmount: bigint;
  flashLoanAmount: bigint;
  useLoanAssetAsInput: boolean;
  onSuccess?: () => void;
};

/**
 * Executes an ERC4626 leverage loop in Bundler V2.
 *
 * Flow:
 * 1) transfer user input token (collateral shares or loan-asset underlying)
 * 2) optionally deposit upfront underlying into ERC4626 collateral shares
 * 3) flash-loan loan token, mint more collateral shares, supply collateral, then borrow back the flash amount
 */
export function useLeverageTransaction({
  market,
  route,
  collateralAmount,
  collateralAmountInCollateralToken,
  flashCollateralAmount,
  flashLoanAmount,
  useLoanAssetAsInput,
  onSuccess,
}: UseLeverageTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const tracking = useTransactionTracking('leverage');
  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const bundlerAddress = getBundlerV2(market.morphoBlue.chain.id);
  const { batchAddUserMarkets } = useUserMarketsCache(account);
  const isLoanAssetInput = useLoanAssetAsInput;
  const inputTokenAddress = isLoanAssetInput ? (market.loanAsset.address as Address) : (market.collateralAsset.address as Address);
  const inputTokenSymbol = isLoanAssetInput ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const inputTokenDecimals = isLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputTokenAmountForTransfer = isLoanAssetInput ? collateralAmount : collateralAmountInCollateralToken;

  const { isBundlerAuthorized, isAuthorizingBundler, ensureBundlerAuthorization, refetchIsBundlerAuthorized } = useBundlerAuthorizationStep(
    {
      chainId: market.morphoBlue.chain.id,
      bundlerAddress: bundlerAddress as Address,
    },
  );

  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: bundlerAddress,
    token: inputTokenAddress as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: inputTokenSymbol,
    amount: inputTokenAmountForTransfer,
  });

  const { isApproved, approve, isApproving } = useERC20Approval({
    token: inputTokenAddress,
    spender: bundlerAddress,
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

  const getStepsForFlow = useCallback(
    (isPermit2: boolean) => {
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

    if (collateralAmount <= 0n || flashLoanAmount <= 0n || flashCollateralAmount <= 0n) {
      toast.info('Invalid leverage inputs', 'Set collateral and multiplier above 1x before submitting.');
      return;
    }

    try {
      const txs: `0x${string}`[] = [];

      if (usePermit2Setting) {
        tracking.update('approve_permit2');
        if (!permit2Authorized) {
          await authorizePermit2();
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        tracking.update('authorize_bundler_sig');
        const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
        if (authorizationTxData) {
          txs.push(authorizationTxData);
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        tracking.update('sign_permit');
        const { sigs, permitSingle } = await signForBundlers();
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'approve2',
            args: [permitSingle, sigs, false],
          }),
        );
      } else {
        tracking.update('authorize_bundler_tx');
        const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
        if (!authorized) {
          throw new Error('Failed to authorize Bundler via transaction.');
        }

        tracking.update('approve_token');
        if (!isApproved) {
          await approve();
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }

      if (inputTokenAmountForTransfer > 0n) {
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: usePermit2Setting ? 'transferFrom2' : 'erc20TransferFrom',
            args: [inputTokenAddress, inputTokenAmountForTransfer],
          }),
        );
      }

      if (isLoanAssetInput) {
        // WHY: this lets users start with loan-token underlying for ERC4626 markets.
        // We mint shares first so all leverage math and downstream Morpho collateral is in share units.
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc4626Deposit',
            args: [
              route.collateralVault,
              collateralAmount,
              withSlippageFloor(collateralAmountInCollateralToken),
              bundlerAddress as Address,
            ],
          }),
        );
      }

      const callbackTxs: `0x${string}`[] = [
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'erc4626Deposit',
          args: [route.collateralVault, flashLoanAmount, withSlippageFloor(flashCollateralAmount), bundlerAddress as Address],
        }),
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoSupplyCollateral',
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            maxUint256,
            account as Address,
            '0x',
          ],
        }),
      ];

      const maxBorrowShares = computeBorrowSharesWithBuffer({
        borrowAssets: flashLoanAmount,
        totalBorrowAssets: BigInt(market.state.borrowAssets),
        totalBorrowShares: BigInt(market.state.borrowShares),
      });

      callbackTxs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoBorrow',
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            flashLoanAmount,
            0n,
            maxBorrowShares,
            bundlerAddress as Address,
          ],
        }),
      );

      const flashLoanCallbackData = encodeAbiParameters([{ type: 'bytes[]' }], [callbackTxs]);
      txs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoFlashLoan',
          args: [market.loanAsset.address as Address, flashLoanAmount, flashLoanCallbackData],
        }),
      );

      tracking.update('execute');
      await new Promise((resolve) => setTimeout(resolve, 800));

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
      console.error('Error during leverage execution:', error);
      if (error instanceof Error && !error.message.toLowerCase().includes('rejected')) {
        toast.error('Leverage Failed', 'An unexpected error occurred during leverage.');
      }
    }
  }, [
    account,
    market,
    route,
    collateralAmount,
    collateralAmountInCollateralToken,
    inputTokenAmountForTransfer,
    inputTokenAddress,
    isLoanAssetInput,
    flashCollateralAmount,
    flashLoanAmount,
    usePermit2Setting,
    permit2Authorized,
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

  const approveAndLeverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    try {
      const initialStep = usePermit2Setting ? 'approve_permit2' : 'authorize_bundler_tx';
      tracking.start(
        getStepsForFlow(usePermit2Setting),
        {
          title: 'Leverage',
          description: `${market.collateralAsset.symbol} leveraged using ${market.loanAsset.symbol} debt`,
          tokenSymbol: inputTokenSymbol,
          amount: collateralAmount,
          marketId: market.uniqueKey,
        },
        initialStep,
      );

      await executeLeverage();
    } catch (error: unknown) {
      console.error('Error in approveAndLeverage:', error);
      tracking.fail();
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Error', 'Failed to process leverage transaction');
        }
      } else {
        toast.error('Error', 'An unexpected error occurred');
      }
    }
  }, [account, usePermit2Setting, tracking, getStepsForFlow, market, inputTokenSymbol, collateralAmount, executeLeverage, toast]);

  const signAndLeverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    try {
      tracking.start(
        getStepsForFlow(usePermit2Setting),
        {
          title: 'Leverage',
          description: `${market.collateralAsset.symbol} leveraged using ${market.loanAsset.symbol} debt`,
          tokenSymbol: inputTokenSymbol,
          amount: collateralAmount,
          marketId: market.uniqueKey,
        },
        'sign_permit',
      );

      await executeLeverage();
    } catch (error: unknown) {
      console.error('Error in signAndLeverage:', error);
      tracking.fail();
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Transaction Error', 'Failed to process leverage transaction');
        }
      } else {
        toast.error('Transaction Error', 'An unexpected error occurred');
      }
    }
  }, [account, tracking, getStepsForFlow, usePermit2Setting, market, inputTokenSymbol, collateralAmount, executeLeverage, toast]);

  const isLoading = leveragePending || isLoadingPermit2 || isApproving || isAuthorizingBundler;

  return {
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as LeverageStepType | null,
    isLoadingPermit2,
    isApproved,
    permit2Authorized,
    leveragePending,
    isLoading,
    isBundlerAuthorized,
    approveAndLeverage,
    signAndLeverage,
  };
}

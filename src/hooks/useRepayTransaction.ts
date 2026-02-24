import { useCallback } from 'react';
import { MathLib } from '@morpho-org/blue-sdk';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection, usePublicClient } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import morphoAbi from '@/abis/morpho';
import { BPS_DENOMINATOR, REPAY_BY_SHARES_BUFFER_BPS } from '@/constants/repay';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, getMorphoAddress, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { estimateRepayAssetsForBorrowShares } from '@/utils/repay-estimation';
import type { Market, MarketPosition } from '@/utils/types';
import { useERC20Approval } from './useERC20Approval';
import { useBundlerAuthorizationStep } from './useBundlerAuthorizationStep';
import { usePermit2 } from './usePermit2';
import { useAppSettings } from '@/stores/useAppSettings';
import { useStyledToast } from './useStyledToast';
import { useTransactionWithToast } from './useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';

type UseRepayTransactionProps = {
  market: Market;
  currentPosition: MarketPosition | null;
  withdrawAmount: bigint;
  repayAssets: bigint;
  repayShares: bigint;
  onSuccess?: () => void;
};

type RepayExecutionPlan = {
  repayTransferAmount: bigint;
  repayBySharesToRepay: bigint;
};

const calculateRepayBySharesBufferedAssets = (baseAssets: bigint): bigint => {
  if (baseAssets <= 0n) return 0n;
  const bpsBuffer = MathLib.mulDivUp(baseAssets, REPAY_BY_SHARES_BUFFER_BPS, BPS_DENOMINATOR);
  return baseAssets + bpsBuffer;
};

const irmAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint128', name: 'totalSupplyAssets', type: 'uint128' },
          { internalType: 'uint128', name: 'totalSupplyShares', type: 'uint128' },
          { internalType: 'uint128', name: 'totalBorrowAssets', type: 'uint128' },
          { internalType: 'uint128', name: 'totalBorrowShares', type: 'uint128' },
          { internalType: 'uint128', name: 'lastUpdate', type: 'uint128' },
          { internalType: 'uint128', name: 'fee', type: 'uint128' },
        ],
        internalType: 'struct Market',
        name: 'market',
        type: 'tuple',
      },
    ],
    name: 'borrowRateView',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useRepayTransaction({
  market,
  currentPosition,
  withdrawAmount,
  repayAssets,
  repayShares,
  onSuccess,
}: UseRepayTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();

  // Transaction tracking
  const tracking = useTransactionTracking('repay');

  const { address: account, chainId } = useConnection();
  const publicClient = usePublicClient({ chainId: market.morphoBlue.chain.id });
  const toast = useStyledToast();
  const bundlerAddress = getBundlerV2(market.morphoBlue.chain.id);

  const useRepayByShares = repayShares > 0n;
  const repayBySharesBaseAssets = useRepayByShares && repayAssets === 0n ? BigInt(currentPosition?.state.borrowAssets ?? 0) : repayAssets;
  const repayAmountToApprove = useRepayByShares ? calculateRepayBySharesBufferedAssets(repayBySharesBaseAssets) : repayAssets;

  const { isAuthorizingBundler, ensureBundlerAuthorization } = useBundlerAuthorizationStep({
    chainId: market.morphoBlue.chain.id,
    bundlerAddress: bundlerAddress as Address,
  });

  // Get approval for loan token
  const {
    authorizePermit2,
    permit2Authorized,
    permit2Allowance,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: bundlerAddress,
    token: market.loanAsset.address as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.loanAsset.symbol,
    amount: repayAmountToApprove,
  });

  const { isApproved, allowance, approve } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: bundlerAddress as Address,
    amount: repayAmountToApprove,
    tokenSymbol: market.loanAsset.symbol,
  });

  const { isConfirming: repayPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'repay',
    pendingText: `${
      repayAssets > 0n || repayShares > 0n
        ? `Repaying ${formatBalance(repayAssets, market.loanAsset.decimals).toString()} ${market.loanAsset.symbol}`
        : ''
    }${
      withdrawAmount > 0n
        ? (repayAssets > 0n || repayShares > 0n ? ' and ' : '') +
          'Withdrawing ' +
          formatBalance(withdrawAmount, market.collateralAsset.decimals).toString() +
          ' ' +
          market.collateralAsset.symbol
        : ''
    }`,
    successText: `${repayAssets > 0n || repayShares > 0n ? `${market.loanAsset.symbol} Repaid` : ''}${
      withdrawAmount > 0n ? `${(repayAssets > 0n || repayShares > 0n ? ' and ' : '') + market.collateralAsset.symbol} Withdrawn` : ''
    }`,
    errorText: 'Transaction failed',
    chainId,
    pendingDescription: `Processing transaction for market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully processed transaction for market ${market.uniqueKey.slice(2, 8)}`,
    onSuccess,
  });

  // Helper to generate steps based on flow type
  const getStepsForFlow = useCallback(
    (isPermit2: boolean) => {
      if (isPermit2) {
        return [
          {
            id: 'approve',
            title: 'Authorize Permit2',
            description: "This one-time approval makes sure you don't need to send approval tx again in the future.",
          },
          { id: 'signing', title: 'Sign message in wallet', description: 'Sign a Permit2 signature to authorize the repayment' },
          { id: 'repaying', title: 'Confirm Repay', description: 'Confirm transaction in wallet to complete the repayment' },
        ];
      }
      return [
        { id: 'approve', title: 'Approve Token', description: `Approve ${market.loanAsset.symbol} for spending` },
        { id: 'repaying', title: 'Confirm Repay', description: 'Confirm transaction in wallet to complete the repayment' },
      ];
    },
    [market.loanAsset.symbol],
  );

  const fetchLiveRepayBySharesMaxAssets = useCallback(
    async (fallbackMaxAssets: bigint): Promise<{ maxAssetsToRepay: bigint; sharesToRepay: bigint }> => {
      if (!useRepayByShares || repayShares <= 0n || !account || !publicClient) {
        return { maxAssetsToRepay: fallbackMaxAssets, sharesToRepay: repayShares };
      }

      console.info('[repay] fetching results: live quote start', {
        marketId: market.uniqueKey,
        account,
        repayShares: repayShares.toString(),
        fallbackMaxAssets: fallbackMaxAssets.toString(),
      });

      try {
        const marketParams = {
          loanToken: market.loanAsset.address as Address,
          collateralToken: market.collateralAsset.address as Address,
          oracle: market.oracleAddress as Address,
          irm: market.irmAddress as Address,
          lltv: BigInt(market.lltv),
        };

        const morphoAddress = getMorphoAddress(market.morphoBlue.chain.id) as Address;
        const [marketResult, positionResult] = await publicClient.multicall({
          contracts: [
            {
              address: morphoAddress,
              abi: morphoAbi,
              functionName: 'market',
              args: [market.uniqueKey as `0x${string}`],
            },
            {
              address: morphoAddress,
              abi: morphoAbi,
              functionName: 'position',
              args: [market.uniqueKey as `0x${string}`, account as Address],
            },
          ],
          allowFailure: false,
        });

        const marketState = marketResult as readonly bigint[];
        const positionState = positionResult as readonly bigint[];
        const liveBorrowShares = positionState[1] ?? 0n;
        const liveTotalBorrowAssets = marketState[2] ?? 0n;
        const liveTotalBorrowShares = marketState[3] ?? 0n;
        const liveLastUpdate = marketState[4] ?? 0n;
        const sharesToRepay = repayShares > liveBorrowShares ? liveBorrowShares : repayShares;

        if (sharesToRepay <= 0n || liveTotalBorrowShares <= 0n) {
          console.info('[repay] fetching results: live quote done', {
            marketId: market.uniqueKey,
            sharesToRepay: sharesToRepay.toString(),
            maxAssetsToRepay: '0',
            reason: 'empty-borrow',
          });
          return { maxAssetsToRepay: 0n, sharesToRepay };
        }

        const borrowRate = await publicClient.readContract({
          address: market.irmAddress as Address,
          abi: irmAbi,
          functionName: 'borrowRateView',
          args: [
            marketParams,
            {
              totalSupplyAssets: marketState[0],
              totalSupplyShares: marketState[1],
              totalBorrowAssets: marketState[2],
              totalBorrowShares: marketState[3],
              lastUpdate: marketState[4],
              fee: marketState[5],
            },
          ],
        });

        const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
        const estimation = estimateRepayAssetsForBorrowShares({
          repayShares: sharesToRepay,
          totalBorrowAssets: liveTotalBorrowAssets,
          totalBorrowShares: liveTotalBorrowShares,
          lastUpdate: liveLastUpdate,
          borrowRate,
          currentTimestamp: latestBlock.timestamp,
        });

        console.info('[repay] fetching results: live quote done', {
          marketId: market.uniqueKey,
          sharesToRepay: sharesToRepay.toString(),
          elapsedSeconds: estimation.elapsedSeconds.toString(),
          assetsToRepayShares: estimation.assetsToRepayShares.toString(),
          safetyAssetsBuffer: estimation.safetyAssetsBuffer.toString(),
          blockDriftBuffer: estimation.blockDriftBuffer.toString(),
          maxAssetsToRepay: estimation.maxAssetsToRepay.toString(),
        });

        return {
          maxAssetsToRepay: estimation.maxAssetsToRepay,
          sharesToRepay,
        };
      } catch (error: unknown) {
        console.warn('[repay] fetching results: live quote failed, fallback used', {
          marketId: market.uniqueKey,
          fallbackMaxAssets: fallbackMaxAssets.toString(),
          error,
        });
        return {
          maxAssetsToRepay: fallbackMaxAssets,
          sharesToRepay: repayShares,
        };
      }
    },
    [account, market, publicClient, repayShares, useRepayByShares],
  );

  const resolveRepayBySharesEstimation = useCallback(async (): Promise<{ maxAssetsToRepay: bigint; sharesToRepay: bigint }> => {
    if (!useRepayByShares) {
      return { maxAssetsToRepay: 0n, sharesToRepay: 0n };
    }
    return fetchLiveRepayBySharesMaxAssets(repayAmountToApprove);
  }, [fetchLiveRepayBySharesMaxAssets, repayAmountToApprove, useRepayByShares]);

  const buildRepayExecutionPlan = useCallback(async (): Promise<RepayExecutionPlan> => {
    if (!useRepayByShares) {
      const plan = {
        repayTransferAmount: repayAssets,
        repayBySharesToRepay: 0n,
      };
      console.info('[repay] fetching results: execution plan', {
        marketId: market.uniqueKey,
        repayTransferAmount: plan.repayTransferAmount.toString(),
      });
      return plan;
    }

    const estimation = await resolveRepayBySharesEstimation();
    const plan = {
      repayTransferAmount: estimation.maxAssetsToRepay,
      repayBySharesToRepay: estimation.sharesToRepay,
    };
    console.info('[repay] fetching results: execution plan', {
      marketId: market.uniqueKey,
      repayTransferAmount: plan.repayTransferAmount.toString(),
      repayBySharesToRepay: plan.repayBySharesToRepay.toString(),
    });
    return plan;
  }, [market.uniqueKey, repayAssets, resolveRepayBySharesEstimation, useRepayByShares]);

  // Core transaction execution logic
  const executeRepayTransaction = useCallback(
    async (executionPlan: RepayExecutionPlan) => {
      if (!currentPosition) {
        toast.error('No Position', 'No active position found');
        return;
      }

      try {
        const txs: `0x${string}`[] = [];
        const { repayTransferAmount, repayBySharesToRepay } = executionPlan;

        if (withdrawAmount > 0n) {
          if (usePermit2Setting) {
            const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
            if (authorizationTxData) {
              txs.push(authorizationTxData);
            }
          } else {
            const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
            if (!authorized) {
              throw new Error('Failed to authorize Bundler for collateral withdrawal.');
            }
          }
        }

        // Add token approval and transfer transactions if repaying
        if ((repayAssets > 0n || repayShares > 0n) && repayTransferAmount > 0n) {
          if (usePermit2Setting) {
            const { sigs, permitSingle } = await signForBundlers(repayTransferAmount);
            const tx1 = encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'approve2',
              args: [permitSingle, sigs, false],
            });

            // transferFrom with permit2
            const tx2 = encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'transferFrom2',
              args: [market.loanAsset.address as Address, repayTransferAmount],
            });

            txs.push(tx1);
            txs.push(tx2);
          } else {
            // For standard ERC20 flow, we only need to transfer the tokens
            txs.push(
              encodeFunctionData({
                abi: morphoBundlerAbi,
                functionName: 'erc20TransferFrom',
                args: [market.loanAsset.address as Address, repayTransferAmount],
              }),
            );
          }
        }

        // Add the repay transaction if there's an amount to repay

        if (useRepayByShares && repayBySharesToRepay > 0n && repayTransferAmount > 0n) {
          const morphoRepayTx = encodeFunctionData({
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
              0n, // assets to repay (0)
              repayBySharesToRepay, // shares to repay
              repayTransferAmount, // Slippage amount: max amount to repay
              account as Address,
              '0x', // bytes
            ],
          });
          txs.push(morphoRepayTx);

          // build another erc20 transfer action, to transfer any surplus back (unused loan assets) back to the user
          const refundTx = encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20Transfer',
            args: [market.loanAsset.address as Address, account as Address, repayTransferAmount],
          });
          txs.push(refundTx);
        } else if (repayAssets > 0n) {
          const minShares = 1n;
          const morphoRepayTx = encodeFunctionData({
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
              repayAssets, // assets to repay
              0n, // shares to repay (0)
              minShares, // Slippage amount: min shares to repay
              account as Address,
              '0x', // bytes
            ],
          });
          txs.push(morphoRepayTx);
        }

        // Add the withdraw transaction if there's an amount to withdraw
        if (withdrawAmount > 0n) {
          const morphoWithdrawTx = encodeFunctionData({
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
              withdrawAmount,
              account as Address,
            ],
          });
          txs.push(morphoWithdrawTx);
        }

        if (txs.length === 0) {
          toast.info('Nothing to execute', 'No repayable debt or withdrawal amount found on-chain.');
          tracking.complete();
          return;
        }

        tracking.update('repaying');

        // Add timeout to prevent rabby reverting
        await new Promise((resolve) => setTimeout(resolve, 800));

        await sendTransactionAsync({
          account,
          to: bundlerAddress,
          data: (encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'multicall',
            args: [txs],
          }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
        });

        tracking.complete();
      } catch (error: unknown) {
        console.error('Error in repay transaction:', error);
        tracking.fail();
        if (error instanceof Error) {
          if (error.message.includes('User rejected')) {
            toast.error('Transaction rejected', 'Transaction rejected by user');
          } else {
            toast.error('Transaction Error', 'Failed to process transaction');
          }
        } else {
          toast.error('Transaction Error', 'An unexpected error occurred');
        }
      }
    },
    [
      account,
      market,
      currentPosition,
      withdrawAmount,
      repayAssets,
      repayShares,
      sendTransactionAsync,
      signForBundlers,
      usePermit2Setting,
      ensureBundlerAuthorization,
      toast,
      useRepayByShares,
      bundlerAddress,
      tracking,
    ],
  );

  // Combined approval and repay flow
  const approveAndRepay = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      const txTitle = withdrawAmount > 0n ? 'Withdraw & Repay' : 'Repay';
      tracking.start(
        getStepsForFlow(usePermit2Setting),
        {
          title: txTitle,
          description: `Repaying ${market.loanAsset.symbol}`,
          tokenSymbol: market.loanAsset.symbol,
          amount: repayAssets,
          marketId: market.uniqueKey,
        },
        'approve',
      );

      const executionPlan = await buildRepayExecutionPlan();

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          if (executionPlan.repayTransferAmount > 0n && permit2Allowance < executionPlan.repayTransferAmount) {
            await authorizePermit2();
          }
          tracking.update('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));

          await executeRepayTransaction(executionPlan);
        } catch (error: unknown) {
          console.error('Error in Permit2 flow:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Transaction rejected', 'Transaction rejected by user');
            } else {
              toast.error('Error', 'Failed to process Permit2 transaction');
            }
          } else {
            toast.error('Error', 'An unexpected error occurred');
          }
          throw error;
        }
      } else {
        // ERC20 approval flow or just withdraw
        const hasRequiredAllowance = allowance >= executionPlan.repayTransferAmount;
        if (!hasRequiredAllowance) {
          try {
            await approve(executionPlan.repayTransferAmount);
          } catch (error: unknown) {
            console.error('Error in approval:', error);
            tracking.fail();
            if (error instanceof Error) {
              if (error.message.includes('User rejected')) {
                toast.error('Approval rejected', 'Approval rejected by user');
              } else {
                toast.error('Approval Error', 'Failed to approve token');
              }
            } else {
              toast.error('Approval Error', 'An unexpected error occurred');
            }
            return;
          }
        }

        tracking.update('repaying');
        await executeRepayTransaction(executionPlan);
      }
    } catch (error: unknown) {
      console.error('Error in approveAndRepay:', error);
      tracking.fail();
    }
  }, [
    account,
    authorizePermit2,
    buildRepayExecutionPlan,
    executeRepayTransaction,
    usePermit2Setting,
    allowance,
    permit2Allowance,
    approve,
    toast,
    tracking,
    getStepsForFlow,
    market,
    repayAssets,
    withdrawAmount,
  ]);

  // Function to handle signing and executing the repay transaction
  const signAndRepay = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      const txTitle = withdrawAmount > 0n ? 'Withdraw & Repay' : 'Repay';
      tracking.start(
        getStepsForFlow(usePermit2Setting),
        {
          title: txTitle,
          description: `Repaying ${market.loanAsset.symbol}`,
          tokenSymbol: market.loanAsset.symbol,
          amount: repayAssets,
          marketId: market.uniqueKey,
        },
        usePermit2Setting ? 'signing' : 'repaying',
      );

      const executionPlan = await buildRepayExecutionPlan();

      if (usePermit2Setting && executionPlan.repayTransferAmount > 0n && permit2Allowance < executionPlan.repayTransferAmount) {
        toast.info('Permit2 approval required', 'Please approve Permit2 before signing this repayment.');
        tracking.fail();
        return;
      }

      if (!usePermit2Setting && allowance < executionPlan.repayTransferAmount) {
        toast.info('Token approval required', `Please approve ${market.loanAsset.symbol} before submitting repayment.`);
        tracking.fail();
        return;
      }

      await executeRepayTransaction(executionPlan);
    } catch (error: unknown) {
      console.error('Error in signAndRepay:', error);
      tracking.fail();
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Transaction Error', 'Failed to process transaction');
        }
      } else {
        toast.error('Transaction Error', 'An unexpected error occurred');
      }
    }
  }, [
    account,
    buildRepayExecutionPlan,
    executeRepayTransaction,
    getStepsForFlow,
    allowance,
    market,
    permit2Allowance,
    repayAssets,
    toast,
    tracking,
    usePermit2Setting,
    withdrawAmount,
  ]);

  return {
    // Transaction tracking
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as 'approve' | 'signing' | 'repaying' | null,
    // State
    isLoadingPermit2: isLoadingPermit2 || isAuthorizingBundler,
    isApproved,
    permit2Authorized,
    repayPending,
    // Actions
    approveAndRepay,
    signAndRepay,
  };
}

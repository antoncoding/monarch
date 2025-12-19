import { useState, useCallback } from 'react';
import { type Address, encodeFunctionData, maxUint256 } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { GroupedPosition, RebalanceAction } from '@/utils/types';
import { GAS_COSTS, GAS_MULTIPLIER } from '@/features/markets/components/constants';
import { useERC20Approval } from './useERC20Approval';
import { useLocalStorage } from './useLocalStorage';
import { useMorphoAuthorization } from './useMorphoAuthorization';
import { usePermit2 } from './usePermit2';
import { useStyledToast } from './useStyledToast';
import { useUserMarketsCache } from './useUserMarketsCache';

// Define more specific step types
export type RebalanceStepType =
  | 'idle'
  | 'approve_permit2' // For Permit2 flow: Step 1
  | 'authorize_bundler_sig' // For Permit2 flow: Step 2 (if needed)
  | 'sign_permit' // For Permit2 flow: Step 3
  | 'authorize_bundler_tx' // For standard flow: Step 1 (if needed)
  | 'approve_token' // For standard flow: Step 2 (if needed)
  | 'execute'; // Common final step

export const useRebalance = (groupedPosition: GroupedPosition, onRebalance?: () => void) => {
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false); // Renamed from isConfirming for clarity
  const [currentStep, setCurrentStep] = useState<RebalanceStepType>('idle');

  const { address: account } = useConnection();
  const bundlerAddress = getBundlerV2(groupedPosition.chainId);
  const toast = useStyledToast();
  const [usePermit2Setting] = useLocalStorage('usePermit2', true); // Read user setting

  const totalAmount = rebalanceActions.reduce((acc, action) => acc + BigInt(action.amount), BigInt(0));

  // Hook for Morpho bundler authorization (both sig and tx)
  const { isBundlerAuthorized, isAuthorizingBundler, authorizeBundlerWithSignature, authorizeWithTransaction, refetchIsBundlerAuthorized } =
    useMorphoAuthorization({
      chainId: groupedPosition.chainId,
      authorized: bundlerAddress,
    });

  // Hook for Permit2 handling
  const {
    authorizePermit2,
    permit2Authorized,
    signForBundlers,
    isLoading: isLoadingPermit2,
  } = usePermit2({
    user: account as Address,
    spender: bundlerAddress,
    token: groupedPosition.loanAssetAddress as Address,
    refetchInterval: 10_000,
    chainId: groupedPosition.chainId,
    tokenSymbol: groupedPosition.loanAsset,
    amount: totalAmount,
  });

  // Hook for standard ERC20 approval
  const {
    isApproved: isTokenApproved,
    approve: approveToken,
    isApproving: isTokenApproving,
  } = useERC20Approval({
    token: groupedPosition.loanAssetAddress as Address,
    spender: bundlerAddress,
    amount: totalAmount,
    tokenSymbol: groupedPosition.loanAsset,
    chainId: groupedPosition.chainId,
  });

  // Add newly used markets to the cache
  const { batchAddUserMarkets } = useUserMarketsCache(account);

  const addRebalanceAction = useCallback((action: RebalanceAction) => {
    setRebalanceActions((prev) => [...prev, action]);
  }, []);

  const removeRebalanceAction = useCallback((index: number) => {
    setRebalanceActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Transaction hook for the final multicall
  const handleTransactionSuccess = useCallback(() => {
    setRebalanceActions([]);
    void refetchIsBundlerAuthorized();
    if (onRebalance) {
      onRebalance();
    }
  }, [refetchIsBundlerAuthorized, onRebalance]);

  const { sendTransactionAsync, isConfirming: isExecuting } = useTransactionWithToast({
    toastId: 'rebalance',
    pendingText: 'Rebalancing positions',
    successText: 'Positions rebalanced successfully',
    errorText: 'Failed to rebalance positions',
    chainId: groupedPosition.chainId,
    onSuccess: handleTransactionSuccess,
  });

  // Helper function to generate common withdraw/supply tx data
  const generateRebalanceTxData = useCallback(() => {
    const withdrawTxs: `0x${string}`[] = [];
    const supplyTxs: `0x${string}`[] = [];
    const allMarketKeys: string[] = [];

    const groupedWithdraws: Record<string, RebalanceAction[]> = {};
    const groupedSupplies: Record<string, RebalanceAction[]> = {};

    rebalanceActions.forEach((action) => {
      const withdrawKey = action.fromMarket.uniqueKey;
      const supplyKey = action.toMarket.uniqueKey;

      if (!groupedWithdraws[withdrawKey]) groupedWithdraws[withdrawKey] = [];
      if (!groupedSupplies[supplyKey]) groupedSupplies[supplyKey] = [];

      groupedWithdraws[withdrawKey].push(action);
      groupedSupplies[supplyKey].push(action);

      if (!allMarketKeys.includes(withdrawKey)) allMarketKeys.push(withdrawKey);
      if (!allMarketKeys.includes(supplyKey)) allMarketKeys.push(supplyKey);
    });

    Object.values(groupedWithdraws).forEach((actions) => {
      const batchAmount = actions.reduce((sum, action) => sum + BigInt(action.amount), BigInt(0));
      const isWithdrawMax = actions.some((action) => action.isMax);
      const shares = isWithdrawMax
        ? groupedPosition.markets.find((m) => m.market.uniqueKey === actions[0].fromMarket.uniqueKey)?.state.supplyShares
        : undefined;

      if (isWithdrawMax && shares === undefined) {
        throw new Error(`No shares found for max withdraw from market ${actions[0].fromMarket.uniqueKey}`);
      }

      const market = actions[0].fromMarket;

      // Add checks for required market properties
      if (!market.loanToken || !market.collateralToken || !market.oracle || !market.irm || market.lltv === undefined) {
        throw new Error(`Market data incomplete for withdraw from ${market.uniqueKey}`);
      }

      const withdrawTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoWithdraw',
        args: [
          {
            loanToken: market.loanToken! as Address,
            collateralToken: market.collateralToken! as Address,
            oracle: market.oracle as Address,
            irm: market.irm as Address,
            lltv: BigInt(market.lltv),
          },
          isWithdrawMax ? BigInt(0) : batchAmount, // assets
          isWithdrawMax ? BigInt(shares as string) : BigInt(0), // shares
          isWithdrawMax ? batchAmount : maxUint256, // maxAssetsToWithdraw or minSharesToWithdraw depending on other inputs
          account!, // receiver (assets sent here)
        ],
      });
      withdrawTxs.push(withdrawTx);
    });

    Object.values(groupedSupplies).forEach((actions) => {
      const batchedAmount = actions.reduce((sum, action) => sum + BigInt(action.amount), BigInt(0));
      const market = actions[0].toMarket;

      // Add checks for required market properties
      if (!market.loanToken || !market.collateralToken || !market.oracle || !market.irm || market.lltv === undefined) {
        throw new Error(`Market data incomplete for supply to ${market.uniqueKey}`);
      }

      const supplyTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoSupply',
        args: [
          {
            loanToken: market.loanToken! as Address,
            collateralToken: market.collateralToken! as Address,
            oracle: market.oracle as Address,
            irm: market.irm as Address,
            lltv: BigInt(market.lltv),
          },
          batchedAmount, // assets
          BigInt(0), // shares (must be 0 if assets > 0)
          BigInt(1), // minShares (slippage control - accept at least 1 share)
          account!, // onBehalf (supply deposited for this account)
          '0x', // callback data
        ],
      });
      supplyTxs.push(supplyTx);
    });

    return { withdrawTxs, supplyTxs, allMarketKeys };
  }, [rebalanceActions, groupedPosition.markets, account]);

  const executeRebalance = useCallback(async () => {
    if (!account || rebalanceActions.length === 0) {
      toast.info('No actions', 'Please add rebalance actions first.');
      return;
    }
    setIsProcessing(true);
    const transactions: `0x${string}`[] = [];

    try {
      const { withdrawTxs, supplyTxs, allMarketKeys } = generateRebalanceTxData();

      let multicallGas = undefined;

      if (usePermit2Setting) {
        // --- Permit2 Flow ---
        setCurrentStep('approve_permit2');
        if (!permit2Authorized) {
          await authorizePermit2(); // Authorize Permit2 contract
          await new Promise((resolve) => setTimeout(resolve, 800)); // UI delay
        }

        setCurrentStep('authorize_bundler_sig');
        const bundlerAuthSigTx = await authorizeBundlerWithSignature(); // Get signature for Bundler auth if needed
        if (bundlerAuthSigTx) {
          transactions.push(bundlerAuthSigTx);
          await new Promise((resolve) => setTimeout(resolve, 800)); // UI delay
        }

        setCurrentStep('sign_permit');
        const { sigs, permitSingle } = await signForBundlers(); // Sign for Permit2 token transfer
        const permitTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'approve2',
          args: [permitSingle, sigs, false],
        });
        const transferFromTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'transferFrom2',
          args: [groupedPosition.loanAssetAddress as Address, totalAmount],
        });

        transactions.push(permitTx);
        transactions.push(...withdrawTxs); // Withdraw first
        transactions.push(transferFromTx); // Then transfer assets via Permit2
        transactions.push(...supplyTxs); // Then supply
      } else {
        // --- Standard ERC20 Flow ---
        setCurrentStep('authorize_bundler_tx');
        const bundlerTxAuthorized = await authorizeWithTransaction(); // Authorize Bundler via TX if needed
        if (!bundlerTxAuthorized) {
          throw new Error('Failed to authorize Bundler via transaction.'); // Stop if auth tx fails/is rejected
        }
        // Wait for tx confirmation implicitly handled by useTransactionWithToast within authorizeWithTransaction

        setCurrentStep('approve_token');
        if (!isTokenApproved) {
          await approveToken(); // Approve ERC20 token
          await new Promise((resolve) => setTimeout(resolve, 1000)); // UI delay
        }

        const erc20TransferTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'erc20TransferFrom',
          args: [groupedPosition.loanAssetAddress as Address, totalAmount],
        });

        transactions.push(...withdrawTxs); // Withdraw first
        transactions.push(erc20TransferTx); // Then transfer assets via standard ERC20
        transactions.push(...supplyTxs); // Then supply

        // estimate gas for multicall
        multicallGas = GAS_COSTS.BUNDLER_REBALANCE;

        if (supplyTxs.length > 1) {
          multicallGas += GAS_COSTS.SINGLE_SUPPLY * (supplyTxs.length - 1);
        }

        if (withdrawTxs.length > 1) {
          multicallGas += GAS_COSTS.SINGLE_WITHDRAW * (withdrawTxs.length - 1);
        }

        console.log('multicallGas', multicallGas);
      }

      // Step Final: Execute multicall
      setCurrentStep('execute');
      const multicallTx = (encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'multicall',
        args: [transactions],
      }) + MONARCH_TX_IDENTIFIER) as `0x${string}`;

      await sendTransactionAsync({
        account,
        to: bundlerAddress,
        data: multicallTx,
        chainId: groupedPosition.chainId,
        gas: multicallGas ? BigInt(multicallGas * GAS_MULTIPLIER) : undefined,
      });

      batchAddUserMarkets(
        allMarketKeys.map((key) => ({
          marketUniqueKey: key,
          chainId: groupedPosition.chainId,
        })),
      );

      return true;
    } catch (error) {
      console.error('Error during rebalance executeRebalance:', error);
      // Log specific details if available, especially for standard flow issues
      if (!usePermit2Setting) {
        console.error('Error occurred during standard ERC20 rebalance flow.');
      }
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        // Attempt to log simulation failure details if present (common pattern)
        if (error.message.toLowerCase().includes('simulation failed') || error.message.toLowerCase().includes('gas estimation failed')) {
          console.error('Potential transaction simulation/estimation failure details:', error);
        }
      }

      // Specific errors should be handled within the sub-functions (auth, approve, sign) with toasts
      if (error instanceof Error && !error.message.toLowerCase().includes('rejected')) {
        toast.error('Rebalance Failed', 'An unexpected error occurred during rebalance.');
      }
      // Don't re-throw generic errors if specific ones were already handled
    } finally {
      setIsProcessing(false);
      setCurrentStep('idle');
    }
  }, [
    account,
    rebalanceActions,
    usePermit2Setting,
    permit2Authorized,
    authorizePermit2,
    authorizeBundlerWithSignature,
    signForBundlers,
    authorizeWithTransaction,
    isTokenApproved,
    approveToken,
    generateRebalanceTxData,
    sendTransactionAsync,
    refetchIsBundlerAuthorized,
    bundlerAddress,
    groupedPosition.chainId,
    groupedPosition.loanAssetAddress,
    totalAmount,
    batchAddUserMarkets,
    toast,
  ]);

  // Determine overall loading state
  const isLoading = isProcessing || isLoadingPermit2 || isTokenApproving || isAuthorizingBundler || isExecuting;

  return {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isProcessing: isLoading, // Use combined loading state
    currentStep,
    // Expose relevant states for UI feedback
    isBundlerAuthorized,
    permit2Authorized, // Relevant only if usePermit2Setting is true
    isTokenApproved, // Relevant only if usePermit2Setting is false
  };
};

import { useCallback, useState } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { useERC20Approval } from './useERC20Approval';
import { useMorphoAuthorization } from './useMorphoAuthorization';
import { usePermit2 } from './usePermit2';
import { useAppSettings } from '@/stores/useAppSettings';
import { useStyledToast } from './useStyledToast';
import { useTransactionWithToast } from './useTransactionWithToast';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';

type UseBorrowTransactionProps = {
  market: Market;
  collateralAmount: bigint;
  borrowAmount: bigint;
  onSuccess?: () => void;
};

// Define step types similar to useRebalance
export type BorrowStepType =
  | 'approve_permit2' // For Permit2 flow: Step 1
  | 'authorize_bundler_sig' // For Permit2 flow: Step 2 (if needed)
  | 'sign_permit' // For Permit2 flow: Step 3
  | 'authorize_bundler_tx' // For standard flow: Step 1 (if needed)
  | 'approve_token' // For standard flow: Step 2 (if needed)
  | 'execute'; // Common final step

export function useBorrowTransaction({ market, collateralAmount, borrowAmount, onSuccess }: UseBorrowTransactionProps) {
  const [currentStep, setCurrentStep] = useState<BorrowStepType>('approve_permit2');
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const [useEth, setUseEth] = useState<boolean>(false);

  // Transaction tracking
  const { start, update, complete, fail, showModal, setModalOpen } = useTransactionTracking('borrow');

  const { address: account, chainId } = useConnection();
  const { batchAddUserMarkets } = useUserMarketsCache(account);
  const toast = useStyledToast();
  const bundlerAddress = getBundlerV2(market.morphoBlue.chain.id);

  // Hook for Morpho bundler authorization (both sig and tx)
  const { isBundlerAuthorized, isAuthorizingBundler, authorizeBundlerWithSignature, authorizeWithTransaction, refetchIsBundlerAuthorized } =
    useMorphoAuthorization({
      chainId: market.morphoBlue.chain.id,
      authorized: bundlerAddress,
    });

  // Get approval for collateral token
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: bundlerAddress,
    token: market.collateralAsset.address as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.collateralAsset.symbol,
    amount: collateralAmount,
  });

  const { isApproved, approve, isApproving } = useERC20Approval({
    token: market.collateralAsset.address as Address,
    spender: bundlerAddress,
    amount: collateralAmount,
    tokenSymbol: market.collateralAsset.symbol,
    chainId: market.morphoBlue.chain.id,
  });

  const { isConfirming: borrowPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'borrow',
    pendingText: `Borrowing ${formatBalance(borrowAmount, market.loanAsset.decimals)} ${market.loanAsset.symbol}`,
    successText: `${market.loanAsset.symbol} Borrowed`,
    errorText: 'Failed to borrow',
    chainId,
    pendingDescription: `Borrowing from market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully borrowed from market ${market.uniqueKey.slice(2, 8)}`,
    onSuccess: () => {
      void refetchIsBundlerAuthorized(); // Refetch bundler auth status
      if (onSuccess) void onSuccess(); // Call external callback
    },
  });

  // Helper to generate steps based on flow type
  const getStepsForFlow = useCallback(
    (isEth: boolean, isPermit2: boolean) => {
      if (isEth) {
        return [{ key: 'execute', label: 'Confirm Borrow', detail: 'Confirm transaction in wallet to complete the borrow' }];
      }
      if (isPermit2) {
        return [
          {
            key: 'approve_permit2',
            label: 'Authorize Permit2',
            detail: "This one-time approval makes sure you don't need to send approval tx again in the future.",
          },
          {
            key: 'authorize_bundler_sig',
            label: 'Authorize Morpho Bundler (Signature)',
            detail: 'Sign a message to authorize the Morpho bundler if needed.',
          },
          { key: 'sign_permit', label: 'Sign Token Permit', detail: 'Sign a Permit2 signature to authorize the collateral' },
          { key: 'execute', label: 'Confirm Borrow', detail: 'Confirm transaction in wallet to complete the borrow' },
        ];
      }
      return [
        {
          key: 'authorize_bundler_tx',
          label: 'Authorize Morpho Bundler (Transaction)',
          detail: 'Submit a transaction to authorize the Morpho bundler if needed.',
        },
        {
          key: 'approve_token',
          label: `Approve ${market.collateralAsset.symbol}`,
          detail: `Approve ${market.collateralAsset.symbol} for spending`,
        },
        { key: 'execute', label: 'Confirm Borrow', detail: 'Confirm transaction in wallet to complete the borrow' },
      ];
    },
    [market.collateralAsset.symbol],
  );

  // Core transaction execution logic
  const executeBorrowTransaction = useCallback(async () => {
    const minSharesToBorrow =
      borrowAmount === 0n ? 0n : (borrowAmount * BigInt(market.state.supplyShares)) / BigInt(market.state.supplyAssets) - 1n;

    try {
      const transactions: `0x${string}`[] = [];

      if (usePermit2Setting) {
        // --- Permit2 Flow ---
        setCurrentStep('approve_permit2');
        update('approve_permit2');
        if (!permit2Authorized) {
          await authorizePermit2(); // Authorize Permit2 contract
          await new Promise((resolve) => setTimeout(resolve, 800)); // UI delay
        }

        setCurrentStep('authorize_bundler_sig');
        update('authorize_bundler_sig');
        const bundlerAuthSigTx = await authorizeBundlerWithSignature(); // Get signature for Bundler auth if needed
        if (bundlerAuthSigTx) {
          transactions.push(bundlerAuthSigTx);
          await new Promise((resolve) => setTimeout(resolve, 800)); // UI delay
        }

        if (collateralAmount > 0n) {
          setCurrentStep('sign_permit');
          update('sign_permit');
          const { sigs, permitSingle } = await signForBundlers();
          console.log('Signed for bundlers:', { sigs, permitSingle });

          const permitTx = encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'approve2',
            args: [permitSingle, sigs, false],
          });

          // transferFrom with permit2
          const transferFromTx = encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'transferFrom2',
            args: [market.collateralAsset.address as Address, collateralAmount],
          });

          transactions.push(permitTx);
          transactions.push(transferFromTx);
        }
      } else {
        // --- Standard ERC20 Flow ---
        setCurrentStep('authorize_bundler_tx');
        update('authorize_bundler_tx');
        const bundlerTxAuthorized = await authorizeWithTransaction(); // Authorize Bundler via TX if needed
        if (!bundlerTxAuthorized) {
          throw new Error('Failed to authorize Bundler via transaction.'); // Stop if auth tx fails/is rejected
        }
        // Wait for tx confirmation implicitly handled by useTransactionWithToast within authorizeWithTransaction

        if (collateralAmount > 0n) {
          setCurrentStep('approve_token');
          update('approve_token');
          if (!isApproved) {
            await approve(); // Approve ERC20 token
            await new Promise((resolve) => setTimeout(resolve, 1000)); // UI delay
          }

          // For standard ERC20 flow, we only need to transfer the tokens
          transactions.push(
            encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'erc20TransferFrom',
              args: [market.collateralAsset.address as Address, collateralAmount],
            }),
          );
        }
      }

      setCurrentStep('execute');
      update('execute');

      if (useEth && collateralAmount > 0n) {
        transactions.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'wrapNative',
            args: [collateralAmount],
          }),
        );
      }

      // Add the supply collateral transaction
      if (collateralAmount > 0n) {
        const morphoAddCollat = encodeFunctionData({
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
            collateralAmount,
            account as Address,
            '0x',
          ],
        });
        transactions.push(morphoAddCollat);
      }

      // Add the borrow transaction
      if (borrowAmount > 0n) {
        const morphoBorrowTx = encodeFunctionData({
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
            borrowAmount, // asset to borrow
            0n, // shares to mint (0), we always use `assets` as param
            minSharesToBorrow, // slippageAmount: min borrow shares
            account as Address,
          ],
        });
        transactions.push(morphoBorrowTx);
      }

      console.log('txs', transactions.length);

      // add timeout here to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await sendTransactionAsync({
        account,
        to: bundlerAddress,
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [transactions],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
        value: useEth ? collateralAmount : 0n,
      });

      batchAddUserMarkets([
        {
          marketUniqueKey: market.uniqueKey,
          chainId: market.morphoBlue.chain.id,
        },
      ]);

      complete();
    } catch (error: unknown) {
      fail();
      console.error('Error during borrow execution:', error);
      if (error instanceof Error && !error.message.toLowerCase().includes('rejected')) {
        toast.error('Borrow Failed', 'An unexpected error occurred during borrow.');
      }
    }
  }, [
    account,
    market,
    collateralAmount,
    borrowAmount,
    sendTransactionAsync,
    useEth,
    usePermit2Setting,
    permit2Authorized,
    authorizePermit2,
    authorizeBundlerWithSignature,
    signForBundlers,
    authorizeWithTransaction,
    isApproved,
    approve,
    batchAddUserMarkets,
    bundlerAddress,
    toast,
    update,
    complete,
    fail,
  ]);

  // Combined approval and borrow flow
  const approveAndBorrow = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      const initialStep = useEth ? 'execute' : usePermit2Setting ? 'approve_permit2' : 'authorize_bundler_tx';
      start(
        getStepsForFlow(useEth, usePermit2Setting),
        { tokenSymbol: market.collateralAsset.symbol, amount: collateralAmount, marketId: market.uniqueKey },
        initialStep,
      );

      await executeBorrowTransaction();
    } catch (error: unknown) {
      console.error('Error in approveAndBorrow:', error);
      fail();
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Error', 'Failed to process transaction');
        }
      } else {
        toast.error('Error', 'An unexpected error occurred');
      }
    }
  }, [account, executeBorrowTransaction, toast, useEth, usePermit2Setting, start, getStepsForFlow, market, collateralAmount, fail]);

  // Function to handle signing and executing the borrow transaction
  const signAndBorrow = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      start(
        getStepsForFlow(useEth, usePermit2Setting),
        { tokenSymbol: market.collateralAsset.symbol, amount: collateralAmount, marketId: market.uniqueKey },
        'sign_permit',
      );

      await executeBorrowTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndBorrow:', error);
      fail();
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
  }, [account, executeBorrowTransaction, toast, start, getStepsForFlow, useEth, usePermit2Setting, market, collateralAmount, fail]);

  // Determine overall loading state
  const isLoading = borrowPending || isLoadingPermit2 || isApproving || isAuthorizingBundler;

  return {
    // State
    currentStep,
    showProcessModal: showModal,
    setShowProcessModal: setModalOpen,
    useEth,
    setUseEth,
    isLoadingPermit2,
    isApproved,
    permit2Authorized,
    borrowPending,
    isLoading,

    // Expose relevant states for UI feedback
    isBundlerAuthorized,

    // Actions
    approveAndBorrow,
    signAndBorrow,
  };
}

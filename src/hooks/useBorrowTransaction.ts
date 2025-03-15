import { useCallback, useState } from 'react';
import { Address, encodeFunctionData } from 'viem';
import { useAccount } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { Market } from '@/utils/types';
import { useERC20Approval } from './useERC20Approval';
import { useLocalStorage } from './useLocalStorage';
import { usePermit2 } from './usePermit2';
import { useStyledToast } from './useStyledToast';
import { useTransactionWithToast } from './useTransactionWithToast';
import { useUserMarketsCache } from './useUserMarketsCache';

type UseBorrowTransactionProps = {
  market: Market;
  collateralAmount: bigint;
  borrowAmount: bigint;
};

export function useBorrowTransaction({
  market,
  collateralAmount,
  borrowAmount,
}: UseBorrowTransactionProps) {
  const [currentStep, setCurrentStep] = useState<'approve' | 'signing' | 'borrowing'>('approve');
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);
  const [useEth, setUseEth] = useState<boolean>(false);

  const { batchAddUserMarkets } = useUserMarketsCache();

  const { address: account, chainId } = useAccount();
  const toast = useStyledToast();

  // Get approval for collateral token
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    token: market.collateralAsset.address as `0x${string}`,
    refetchInterval: 10000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.collateralAsset.symbol,
    amount: collateralAmount,
  });

  const { isApproved, approve } = useERC20Approval({
    token: market.collateralAsset.address as Address,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    amount: collateralAmount,
    tokenSymbol: market.collateralAsset.symbol,
  });

  const { isConfirming: borrowPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'borrow',
    pendingText: `Borrowing ${formatBalance(borrowAmount, market.loanAsset.decimals)} ${
      market.loanAsset.symbol
    }`,
    successText: `${market.loanAsset.symbol} Borrowed`,
    errorText: 'Failed to borrow',
    chainId,
    pendingDescription: `Borrowing from market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully borrowed from market ${market.uniqueKey.slice(2, 8)}`,
  });

  // Core transaction execution logic
  const executeBorrowTransaction = useCallback(async () => {
    const minSharesToBorrow =
      (borrowAmount * BigInt(market.state.supplyShares)) / BigInt(market.state.supplyAssets) - 1n;

    try {
      const txs: `0x${string}`[] = [];

      if (useEth) {
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'wrapNative',
            args: [collateralAmount],
          }),
        );
      } else if (usePermit2Setting) {
        const { sigs, permitSingle } = await signForBundlers();
        console.log('Signed for bundlers:', { sigs, permitSingle });

        const tx1 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'approve2',
          args: [permitSingle, sigs, false],
        });

        // transferFrom with permit2
        const tx2 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'transferFrom2',
          args: [market.collateralAsset.address as Address, collateralAmount],
        });

        txs.push(tx1);
        txs.push(tx2);
      } else {
        // For standard ERC20 flow, we only need to transfer the tokens
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20TransferFrom',
            args: [market.collateralAsset.address as Address, collateralAmount],
          }),
        );
      }

      setCurrentStep('borrowing');

      // Add the borrow transaction
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

      txs.push(morphoAddCollat);
      txs.push(morphoBorrowTx);

      // add timeout here to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await sendTransactionAsync({
        account,
        to: getBundlerV2(market.morphoBlue.chain.id),
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
        value: useEth ? collateralAmount : 0n,
      });

      batchAddUserMarkets([
        {
          marketUniqueKey: market.uniqueKey,
          chainId: market.morphoBlue.chain.id,
        },
      ]);

      // come back to main borrow page
      setShowProcessModal(false);
    } catch (error: unknown) {
      setShowProcessModal(false);
      toast.error('Borrow Failed', 'Borrow from market failed or cancelled');
    }
  }, [
    account,
    market,
    collateralAmount,
    borrowAmount,
    sendTransactionAsync,
    useEth,
    signForBundlers,
    usePermit2Setting,
    toast,
  ]);

  // Combined approval and borrow flow
  const approveAndBorrow = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('approve');

      if (useEth) {
        setCurrentStep('borrowing');
        await executeBorrowTransaction();
        return;
      }

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          await authorizePermit2();
          setCurrentStep('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));

          await executeBorrowTransaction();
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
        // ERC20 approval flow
        if (!isApproved) {
          try {
            await approve();
          } catch (error: unknown) {
            console.error('Error in approval:', error);
            setShowProcessModal(false);
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

        setCurrentStep('borrowing');
        await executeBorrowTransaction();
      }
    } catch (error: unknown) {
      console.error('Error in approveAndBorrow:', error);
      setShowProcessModal(false);
    }
  }, [
    account,
    authorizePermit2,
    executeBorrowTransaction,
    useEth,
    usePermit2Setting,
    isApproved,
    approve,
    toast,
  ]);

  // Function to handle signing and executing the borrow transaction
  const signAndBorrow = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('signing');
      await executeBorrowTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndBorrow:', error);
      setShowProcessModal(false);
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
  }, [account, executeBorrowTransaction, toast]);

  return {
    // State
    currentStep,
    showProcessModal,
    setShowProcessModal,
    useEth,
    setUseEth,
    isLoadingPermit2,
    isApproved,
    permit2Authorized,
    borrowPending,

    // Actions
    approveAndBorrow,
    signAndBorrow,
  };
}

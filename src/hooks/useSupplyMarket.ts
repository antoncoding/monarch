import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { type Address, encodeFunctionData, erc20Abi } from 'viem';
import { useConnection, useBalance, useReadContract } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { usePermit2 } from '@/hooks/usePermit2';
import { useAppSettings } from '@/stores/useAppSettings';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { GAS_COSTS, GAS_MULTIPLIER } from '@/features/markets/components/constants';

export type SupplyStepType = 'approve' | 'signing' | 'supplying';

export type UseSupplyMarketReturn = {
  // State
  supplyAmount: bigint;
  setSupplyAmount: Dispatch<SetStateAction<bigint>>;
  inputError: string | null;
  setInputError: Dispatch<SetStateAction<string | null>>;
  useEth: boolean;
  setUseEth: Dispatch<SetStateAction<boolean>>;
  showProcessModal: boolean;
  setShowProcessModal: Dispatch<SetStateAction<boolean>>;
  currentStep: SupplyStepType;

  // Balance data
  tokenBalance: bigint | undefined;
  ethBalance: bigint | undefined;

  // Transaction state
  isApproved: boolean;
  permit2Authorized: boolean;
  isLoadingPermit2: boolean;
  supplyPending: boolean;

  // Actions
  approveAndSupply: () => Promise<void>;
  signAndSupply: () => Promise<void>;
  refetch: () => void;
};

export function useSupplyMarket(market: Market, onSuccess?: () => void): UseSupplyMarketReturn {
  // State
  const [supplyAmount, setSupplyAmount] = useState<bigint>(BigInt(0));
  const [inputError, setInputError] = useState<string | null>(null);
  const [useEth, setUseEth] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<SupplyStepType>('approve');
  const { usePermit2: usePermit2Setting } = useAppSettings();

  // Transaction tracking
  const { start, update, complete, fail, showModal, setModalOpen } = useTransactionTracking('supply');

  const { address: account, chainId } = useConnection();
  const { batchAddUserMarkets } = useUserMarketsCache(account);
  const toast = useStyledToast();

  // Get token balance
  const { data: tokenBalance, refetch: refetchToken } = useReadContract({
    address: market.loanAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    abi: erc20Abi,
    functionName: 'balanceOf',
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account,
    },
  });

  // Get ETH balance
  const { data: ethBalance, refetch: refetchETH } = useBalance({
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  // Handle Permit2 authorization
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    token: market.loanAsset.address as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.loanAsset.symbol,
    amount: supplyAmount,
  });

  // Handle ERC20 approval
  const { isApproved, approve } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    amount: supplyAmount,
    tokenSymbol: market.loanAsset.symbol,
  });

  const refetch = useCallback(() => {
    void refetchToken();
    void refetchETH();
  }, [refetchETH, refetchToken]);

  // Transaction handler
  const { isConfirming: supplyPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'supply',
    pendingText: `Supplying ${formatBalance(supplyAmount, market.loanAsset.decimals)} ${market.loanAsset.symbol}`,
    successText: `${market.loanAsset.symbol} Supplied`,
    errorText: 'Failed to supply',
    chainId,
    pendingDescription: `Supplying to market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully supplied to market ${market.uniqueKey.slice(2, 8)}`,
    onSuccess,
  });

  // Helper to generate steps based on flow type
  const getStepsForFlow = useCallback(
    (isEth: boolean, isPermit2: boolean) => {
      if (isEth) {
        return [{ key: 'supplying', label: 'Confirm Supply', detail: 'Confirm transaction in wallet to complete the supply' }];
      }
      if (isPermit2) {
        return [
          {
            key: 'approve',
            label: 'Authorize Permit2',
            detail: "This one-time approval makes sure you don't need to send approval tx again in the future.",
          },
          { key: 'signing', label: 'Sign message in wallet', detail: 'Sign a Permit2 signature to authorize the supply' },
          { key: 'supplying', label: 'Confirm Supply', detail: 'Confirm transaction in wallet to complete the supply' },
        ];
      }
      return [
        { key: 'approve', label: 'Approve Token', detail: `Approve ${market.loanAsset.symbol} for spending` },
        { key: 'supplying', label: 'Confirm Supply', detail: 'Confirm transaction in wallet to complete the supply' },
      ];
    },
    [market.loanAsset.symbol],
  );

  // Execute supply transaction
  const executeSupplyTransaction = useCallback(async () => {
    try {
      const txs: `0x${string}`[] = [];

      let gas = undefined;

      if (useEth) {
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'wrapNative',
            args: [supplyAmount],
          }),
        );
      } else if (usePermit2Setting) {
        // if user turned on gasless mode (already approved Permit2), ask for a sinature to transfer assets
        const { sigs, permitSingle } = await signForBundlers();

        const tx1 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'approve2',
          args: [permitSingle, sigs, false],
        });

        // transferFrom with permit2
        const tx2 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'transferFrom2',
          args: [market.loanAsset.address as Address, supplyAmount],
        });

        txs.push(tx1);
        txs.push(tx2);
      } else {
        // For standard ERC20 flow, we only need to transfer the tokens to the bundler
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20TransferFrom',
            args: [market.loanAsset.address as Address, supplyAmount],
          }),
        );

        // Standard Flow: add gas
        gas = GAS_COSTS.SINGLE_SUPPLY;
      }

      setCurrentStep('supplying');
      update('supplying');

      const minShares = BigInt(1);
      const morphoSupplyTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoSupply',
        args: [
          {
            loanToken: market.loanAsset.address as Address,
            collateralToken: market.collateralAsset.address as Address,
            oracle: market.oracleAddress as Address,
            irm: market.irmAddress as Address,
            lltv: BigInt(market.lltv),
          },
          supplyAmount,
          BigInt(0),
          minShares,
          account as `0x${string}`,
          '0x', // callback
        ],
      });

      txs.push(morphoSupplyTx);

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
        value: useEth ? supplyAmount : 0n,

        // Only add gas for standard approval flow -> skip gas estimation
        gas: gas ? BigInt(gas * GAS_MULTIPLIER) : undefined,
      });

      batchAddUserMarkets([
        {
          marketUniqueKey: market.uniqueKey,
          chainId: market.morphoBlue.chain.id,
        },
      ]);

      complete();
      return true;
    } catch (_error: unknown) {
      fail();
      toast.error('Supply Failed', 'Supply to market failed or cancelled');
      return false;
    }
  }, [account, market, supplyAmount, sendTransactionAsync, useEth, signForBundlers, usePermit2Setting, toast, batchAddUserMarkets, update, complete, fail]);

  // Approve and supply handler
  const approveAndSupply = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setCurrentStep('approve');
      const initialStep = useEth ? 'supplying' : 'approve';
      start(getStepsForFlow(useEth, usePermit2Setting), { tokenSymbol: market.loanAsset.symbol, amount: supplyAmount, marketId: market.uniqueKey }, initialStep);

      if (useEth) {
        setCurrentStep('supplying');
        await executeSupplyTransaction();
        return;
      }

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          await authorizePermit2();
          setCurrentStep('signing');
          update('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));

          await executeSupplyTransaction();
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
        return;
      }

      // Standard ERC20 flow
      if (isApproved) {
        setCurrentStep('supplying');
        update('supplying');
      } else {
        try {
          await approve();
          setCurrentStep('supplying');
          update('supplying');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: unknown) {
          console.error('Error in approval:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Transaction rejected', 'Approval rejected by user');
            } else {
              toast.error('Transaction Error', 'Failed to approve token');
            }
          } else {
            toast.error('Transaction Error', 'An unexpected error occurred during approval');
          }
          throw error;
        }
      }

      await executeSupplyTransaction();
    } catch (error: unknown) {
      console.error('Error in approveAndSupply:', error);
      fail();
    }
  }, [account, authorizePermit2, executeSupplyTransaction, useEth, usePermit2Setting, isApproved, approve, toast, start, update, fail, getStepsForFlow, market, supplyAmount]);

  // Sign and supply handler
  const signAndSupply = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setCurrentStep('signing');
      start(getStepsForFlow(useEth, usePermit2Setting), { tokenSymbol: market.loanAsset.symbol, amount: supplyAmount, marketId: market.uniqueKey }, 'signing');

      await executeSupplyTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndSupply:', error);
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
  }, [account, executeSupplyTransaction, toast, start, fail, getStepsForFlow, useEth, usePermit2Setting, market, supplyAmount]);

  return {
    // State
    supplyAmount,
    setSupplyAmount,
    inputError,
    setInputError,
    useEth,
    setUseEth,
    showProcessModal: showModal,
    setShowProcessModal: setModalOpen,
    currentStep,

    // Balance data
    tokenBalance,
    ethBalance: ethBalance?.value,
    refetch,

    // Transaction state
    isApproved,
    permit2Authorized,
    isLoadingPermit2,
    supplyPending,

    // Actions
    approveAndSupply,
    signAndSupply,
  };
}

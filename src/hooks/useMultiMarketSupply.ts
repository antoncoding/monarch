import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { Address, encodeFunctionData } from 'viem';
import { useAccount } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { usePermit2 } from '@/hooks/usePermit2';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2 } from '@/utils/morpho';
import { Market } from '@/utils/types';

export type MarketSupply = {
  market: Market;
  amount: bigint;
};

export function useMultiMarketSupply(
  supplies: MarketSupply[],
  useEth: boolean,
  usePermit2Setting: boolean,
) {
  const [currentStep, setCurrentStep] = useState<'approve' | 'signing' | 'supplying'>('approve');
  const [showProcessModal, setShowProcessModal] = useState(false);

  const { address: account } = useAccount();
  const chainId = supplies[0]?.market.morphoBlue.chain.id;
  const tokenSymbol = supplies[0]?.market.loanAsset.symbol;
  const totalAmount = supplies.reduce((sum, supply) => sum + supply.amount, 0n);

  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(chainId),
    token: supplies[0]?.market.loanAsset.address as `0x${string}`,
    refetchInterval: 10000,
    chainId,
    tokenSymbol,
    amount: totalAmount,
  });

  const { isConfirming: supplyPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'multi-supply',
    pendingText: `Supplying ${formatBalance(
      totalAmount,
      supplies[0]?.market.loanAsset.decimals,
    )} ${tokenSymbol}`,
    successText: `${tokenSymbol} Supplied`,
    errorText: 'Failed to supply',
    chainId,
    pendingDescription: `Supplying to ${supplies.length} market${supplies.length > 1 ? 's' : ''}`,
    successDescription: `Successfully supplied to ${supplies.length} market${
      supplies.length > 1 ? 's' : ''
    }`,
  });

  const executeSupplyTransaction = useCallback(async () => {
    if (!account) return;

    try {
      const txs: `0x${string}`[] = [];

      // Handle ETH wrapping if needed
      if (useEth) {
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'wrapNative',
            args: [totalAmount],
          }),
        );
      }
      // Handle token approvals
      else if (usePermit2Setting) {
        const { sigs, permitSingle } = await signForBundlers();
        console.log('Signed for bundlers:', { sigs, permitSingle });

        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'approve2',
            args: [permitSingle, sigs, false],
          }),
        );

        // transferFrom with permit2
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'transferFrom2',
            args: [supplies[0].market.loanAsset.address as Address, totalAmount],
          }),
        );
      } else {
        // For standard ERC20 flow
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20TransferFrom',
            args: [supplies[0].market.loanAsset.address as Address, totalAmount],
          }),
        );
      }

      setCurrentStep('supplying');

      // Add supply transactions for each market
      for (const supply of supplies) {
        const morphoSupplyTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoSupply',
          args: [
            {
              loanToken: supply.market.loanAsset.address as Address,
              collateralToken: supply.market.collateralAsset.address as Address,
              oracle: supply.market.oracleAddress as Address,
              irm: supply.market.irmAddress as Address,
              lltv: BigInt(supply.market.lltv),
            },
            supply.amount,
            BigInt(0),
            BigInt(1), // minShares
            account as `0x${string}`,
            '0x', // callback
          ],
        });

        txs.push(morphoSupplyTx);
      }

      // Add timeout to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await sendTransactionAsync({
        account,
        to: getBundlerV2(chainId),
        data: encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }),
        value: useEth ? totalAmount : 0n,
      });

      setShowProcessModal(false);
    } catch (error: unknown) {
      setShowProcessModal(false);
      if (error instanceof Error) {
        toast.error('An error occurred. Please try again.');
      } else {
        toast.error('An unexpected error occurred');
      }
    }
  }, [
    account,
    supplies,
    totalAmount,
    sendTransactionAsync,
    useEth,
    signForBundlers,
    usePermit2Setting,
    chainId,
  ]);

  const approveAndSupply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('approve');

      if (!useEth) {
        if (usePermit2Setting && !permit2Authorized) {
          await authorizePermit2();
        }
        setCurrentStep('signing');
      }

      await executeSupplyTransaction();
    } catch (error) {
      setShowProcessModal(false);
      console.error('Error in approveAndSupply:', error);
    }
  }, [
    account,
    useEth,
    usePermit2Setting,
    permit2Authorized,
    authorizePermit2,
    executeSupplyTransaction,
  ]);

  return {
    approveAndSupply,
    currentStep,
    showProcessModal,
    setShowProcessModal,
    supplyPending,
    isLoadingPermit2,
  };
}

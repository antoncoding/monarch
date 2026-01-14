import { useCallback } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { usePermit2 } from '@/hooks/usePermit2';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import type { NetworkToken } from '@/types/token';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { GAS_COSTS, GAS_MULTIPLIER_NUMERATOR, GAS_MULTIPLIER_DENOMINATOR } from '@/features/markets/components/constants';
import { useERC20Approval } from './useERC20Approval';
import { useStyledToast } from './useStyledToast';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';

export type MarketSupply = {
  market: Market;
  amount: bigint;
};

export function useMultiMarketSupply(
  loanAsset: NetworkToken | undefined,
  supplies: MarketSupply[],
  useEth: boolean,
  usePermit2Setting: boolean,
  onSuccess?: () => void,
) {
  const tracking = useTransactionTracking('multi-supply');
  const toast = useStyledToast();

  const { address: account } = useConnection();
  const chainId = loanAsset?.network;
  const tokenSymbol = loanAsset?.symbol;
  const totalAmount = supplies.reduce((sum, supply) => sum + supply.amount, 0n);

  const { batchAddUserMarkets } = useUserMarketsCache(account);

  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(chainId ?? SupportedNetworks.Mainnet),
    token: loanAsset?.address as `0x${string}`,
    refetchInterval: 10_000,
    chainId,
    tokenSymbol,
    amount: totalAmount,
  });

  const { isApproved, approve } = useERC20Approval({
    token: loanAsset?.address as Address,
    spender: getBundlerV2(chainId ?? SupportedNetworks.Mainnet),
    amount: totalAmount,
    tokenSymbol: loanAsset?.symbol ?? '',
  });

  const { isConfirming: supplyPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'multi-supply',
    pendingText: `Supplying ${formatBalance(totalAmount, loanAsset?.decimals ?? 18)} ${tokenSymbol}`,
    successText: `${tokenSymbol} Supplied`,
    errorText: 'Failed to supply',
    chainId,
    pendingDescription: `Supplying to ${supplies.length} market${supplies.length > 1 ? 's' : ''}`,
    successDescription: `Successfully supplied to ${supplies.length} market${supplies.length > 1 ? 's' : ''}`,
    onSuccess,
  });

  const executeSupplyTransaction = useCallback(async () => {
    if (!account) throw new Error('No account connected');
    if (!loanAsset || !chainId) throw new Error('Invalid loan asset or chain');

    const txs: `0x${string}`[] = [];

    let gas: bigint | undefined = undefined;

    try {
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
      // Token approvals with Permit 2
      else if (usePermit2Setting) {
        tracking.update('signing');
        const { sigs, permitSingle } = await signForBundlers();

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
            args: [loanAsset.address as Address, totalAmount],
          }),
        );
      } else {
        // For standard ERC20 flow
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20TransferFrom',
            args: [loanAsset.address as Address, totalAmount],
          }),
        );

        const numOfSupplies = supplies.length;
        gas = GAS_COSTS.BUNDLER_SUPPLY + GAS_COSTS.SINGLE_SUPPLY * BigInt(numOfSupplies - 1);
      }

      tracking.update('supplying');

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
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
        value: useEth ? totalAmount : 0n,

        // Only add gas for standard approval flow -> skip gas estimation
        gas: gas ? (gas * GAS_MULTIPLIER_NUMERATOR) / GAS_MULTIPLIER_DENOMINATOR : undefined,
      });

      batchAddUserMarkets(
        supplies.map((supply) => ({
          marketUniqueKey: supply.market.uniqueKey,
          chainId: supply.market.morphoBlue.chain.id,
        })),
      );

      tracking.complete();
      return true;
    } catch (error: unknown) {
      console.error('Error in executeSupplyTransaction:', error);
      tracking.fail();
      if (error instanceof Error) {
        toast.error('Transaction failed', error.message);
      } else {
        toast.error('Transaction failed', 'Transaction failed or canceled');
      }
      throw error; // Re-throw to be caught by approveAndSupply
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
    loanAsset,
    toast,
    tracking,
  ]);

  const approveAndSupply = useCallback(async () => {
    if (!account) {
      toast.error('No account connected', 'Please connect your wallet to continue.');
      return false;
    }

    try {
      // Start tracking with appropriate steps based on flow
      const steps = useEth
        ? [{ id: 'supplying', title: 'Supplying', description: `Supplying ${tokenSymbol}` }]
        : usePermit2Setting
          ? [
              { id: 'approve', title: 'Authorize Permit2', description: 'Approving Permit2 for token transfers' },
              { id: 'signing', title: 'Sign Permit', description: 'Sign the permit message' },
              { id: 'supplying', title: 'Supplying', description: `Supplying ${tokenSymbol}` },
            ]
          : [
              { id: 'approve', title: 'Approve Token', description: `Approving ${tokenSymbol} for transfer` },
              { id: 'supplying', title: 'Supplying', description: `Supplying ${tokenSymbol}` },
            ];

      tracking.start(
        steps,
        {
          title: `Supply ${tokenSymbol}`,
          description: `Supplying to ${supplies.length} market${supplies.length > 1 ? 's' : ''}`,
          tokenSymbol,
        },
        useEth ? 'supplying' : 'approve',
      );

      if (useEth) {
        const success = await executeSupplyTransaction();
        return success;
      }

      if (usePermit2Setting && !permit2Authorized) {
        try {
          await authorizePermit2();
          tracking.update('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error in Permit2 authorization:', error);
          tracking.fail();
          return false;
        }
      } else if (!usePermit2Setting && !isApproved) {
        // Standard ERC20 flow
        try {
          await approve();
          tracking.update('supplying');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('Error in ERC20 approval:', error);
          tracking.fail();
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Approval rejected', 'Token approval rejected by the user');
            } else {
              toast.error('Failed to approve token');
            }
          } else {
            toast.error('An unexpected error occurred during approval');
          }
          return false;
        }
      }

      const success = await executeSupplyTransaction();
      return success;
    } catch (error) {
      console.error('Error in approveAndSupply:', error);
      tracking.fail();
      return false;
    }
  }, [
    account,
    usePermit2Setting,
    permit2Authorized,
    authorizePermit2,
    isApproved,
    approve,
    useEth,
    executeSupplyTransaction,
    toast,
    tracking,
    tokenSymbol,
    supplies,
  ]);

  return {
    approveAndSupply,
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep,
    supplyPending,
    isLoadingPermit2,
  };
}

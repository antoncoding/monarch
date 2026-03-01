import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { type Address, encodeFunctionData, maxUint256, zeroAddress } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { GroupedPosition } from '@/utils/types';
import type { SmartRebalanceResult, MarketDelta } from '@/utils/smart-rebalance';
import { GAS_COSTS, GAS_MULTIPLIER_NUMERATOR, GAS_MULTIPLIER_DENOMINATOR } from '@/features/markets/components/constants';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import { useERC20Approval } from './useERC20Approval';
import { useBundlerAuthorizationStep } from './useBundlerAuthorizationStep';
import { usePermit2 } from './usePermit2';
import { useAppSettings } from '@/stores/useAppSettings';
import { useStyledToast } from './useStyledToast';

const SMART_REBALANCE_FEE_BPS = 10n; // measured in tenths of a BPS.
const FEE_BPS_DENOMINATOR = 100_000n;
const FEE_RECIPIENT = '0xdb24a3611e7dd442c0fa80b32325ce92655e4eaf' as Address;

export type SmartRebalanceStepType =
  | 'idle'
  | 'approve_permit2'
  | 'authorize_bundler_sig'
  | 'sign_permit'
  | 'authorize_bundler_tx'
  | 'approve_token'
  | 'execute';

export const useSmartRebalance = (
  groupedPosition: GroupedPosition,
  result: SmartRebalanceResult | null,
) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const tracking = useTransactionTracking('smart-rebalance');

  const { address: account } = useConnection();
  const bundlerAddress = getBundlerV2(groupedPosition.chainId);
  const hasBundler = bundlerAddress !== zeroAddress;
  const toast = useStyledToast();
  const { usePermit2: usePermit2Setting } = useAppSettings();

  // Compute totalMoved from negative deltas (withdrawals)
  const totalMoved = useMemo(() => {
    if (!result) return 0n;
    return result.deltas.reduce((acc, d) => {
      if (d.delta < 0n) return acc + (-d.delta);
      return acc;
    }, 0n);
  }, [result]);

  // Fee amount
  const feeAmount = useMemo(() => {
    return (totalMoved * SMART_REBALANCE_FEE_BPS) / FEE_BPS_DENOMINATOR;
  }, [totalMoved]);

  // Hook for Morpho bundler authorization
  const { isBundlerAuthorized, isAuthorizingBundler, ensureBundlerAuthorization, refetchIsBundlerAuthorized } =
    useBundlerAuthorizationStep({
      chainId: groupedPosition.chainId,
      bundlerAddress: bundlerAddress as Address,
    });

  // Hook for Permit2 handling
  const {
    authorizePermit2,
    permit2Authorized,
    signForBundlers,
    isLoading: isLoadingPermit2,
  } = usePermit2({
    user: account,
    spender: bundlerAddress,
    token: groupedPosition.loanAssetAddress as Address,
    refetchInterval: 10_000,
    chainId: groupedPosition.chainId,
    tokenSymbol: groupedPosition.loanAsset,
    amount: totalMoved,
  });

  // Refs to access latest permit2 state inside async callbacks
  const permit2AuthorizedRef = useRef(permit2Authorized);
  const isLoadingPermit2Ref = useRef(isLoadingPermit2);
  useEffect(() => { permit2AuthorizedRef.current = permit2Authorized; }, [permit2Authorized]);
  useEffect(() => { isLoadingPermit2Ref.current = isLoadingPermit2; }, [isLoadingPermit2]);

  // Hook for standard ERC20 approval
  const {
    isApproved: isTokenApproved,
    approve: approveToken,
    isApproving: isTokenApproving,
  } = useERC20Approval({
    token: groupedPosition.loanAssetAddress as Address,
    spender: bundlerAddress,
    amount: totalMoved,
    tokenSymbol: groupedPosition.loanAsset,
    chainId: groupedPosition.chainId,
  });

  const handleTransactionSuccess = useCallback(() => {
    void refetchIsBundlerAuthorized();
  }, [refetchIsBundlerAuthorized]);

  const { sendTransactionAsync, isConfirming: isExecuting } = useTransactionWithToast({
    toastId: 'smart-rebalance',
    pendingText: 'Smart rebalancing positions',
    successText: 'Smart rebalance completed successfully',
    errorText: 'Failed to smart rebalance positions',
    chainId: groupedPosition.chainId,
    onSuccess: handleTransactionSuccess,
  });

  // Generate withdraw/supply tx data from SmartRebalanceResult deltas
  const generateSmartRebalanceTxData = useCallback(() => {
    if (!result || !account) throw new Error('Missing result or account');

    const withdrawTxs: `0x${string}`[] = [];
    const supplyTxs: `0x${string}`[] = [];

    for (const d of result.deltas) {
      if (d.delta >= 0n) continue; // skip supplies and zero deltas

      const withdrawAmount = -d.delta;
      const market = d.market;

      if (!market.loanAsset?.address || !market.collateralAsset?.address || !market.oracleAddress || !market.irmAddress || market.lltv === undefined) {
        throw new Error(`Market data incomplete for withdraw from ${market.uniqueKey}`);
      }

      const marketParams = {
        loanToken: market.loanAsset.address as Address,
        collateralToken: market.collateralAsset.address as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      };

      // Smart rebalance always leaves dust, so never do a full shares-based withdrawal
      const withdrawTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoWithdraw',
        args: [
          marketParams,
          withdrawAmount,
          0n,
          maxUint256,
          account,
        ],
      });
      withdrawTxs.push(withdrawTx);
    }

    for (const d of result.deltas) {
      if (d.delta <= 0n) continue; // skip withdrawals and zero deltas

      const market = d.market;

      if (!market.loanAsset?.address || !market.collateralAsset?.address || !market.oracleAddress || !market.irmAddress || market.lltv === undefined) {
        throw new Error(`Market data incomplete for supply to ${market.uniqueKey}`);
      }

      const marketParams = {
        loanToken: market.loanAsset.address as Address,
        collateralToken: market.collateralAsset.address as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      };

      // Reduce supply amount by fee share: targetDelta - (targetDelta * 10 / 10_000)
      const reducedAmount = d.delta - (d.delta * SMART_REBALANCE_FEE_BPS) / FEE_BPS_DENOMINATOR;

      const supplyTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoSupply',
        args: [
          marketParams,
          reducedAmount,
          0n,
          1n, // minShares
          account,
          '0x',
        ],
      });
      supplyTxs.push(supplyTx);
    }

    return { withdrawTxs, supplyTxs };
  }, [result, account, groupedPosition.markets]);

  // Helper to generate steps based on flow type
  const getStepsForFlow = useCallback(
    (isPermit2: boolean) => {
      if (isPermit2) {
        return [
          { id: 'approve_permit2', title: 'Authorize Permit2', description: "One-time approval for future transactions." },
          { id: 'authorize_bundler_sig', title: 'Authorize Morpho Bundler', description: 'Sign a message to authorize the Morpho bundler.' },
          { id: 'sign_permit', title: 'Sign Token Permit', description: 'Sign a Permit2 signature to authorize the token transfer.' },
          { id: 'execute', title: 'Confirm Smart Rebalance', description: 'Confirm transaction in wallet to complete the smart rebalance.' },
        ];
      }
      return [
        { id: 'authorize_bundler_tx', title: 'Authorize Morpho Bundler (Transaction)', description: 'Submit a transaction to authorize the Morpho bundler.' },
        { id: 'approve_token', title: `Approve ${groupedPosition.loanAsset}`, description: `Approve ${groupedPosition.loanAsset} for spending.` },
        { id: 'execute', title: 'Confirm Smart Rebalance', description: 'Confirm transaction in wallet to complete the smart rebalance.' },
      ];
    },
    [groupedPosition.loanAsset],
  );

  const executeSmartRebalance = useCallback(async (summaryItems?: TransactionSummaryItem[]) => {
    if (!account || !result || totalMoved === 0n) {
      toast.info('Nothing to rebalance', 'No moves to execute.');
      return;
    }

    if (!hasBundler) {
      toast.error('Unsupported chain', 'Smart rebalance is not available on this chain.');
      return;
    }

    setIsProcessing(true);

    // Wait for permit2 allowance query to resolve before checking authorization
    while (isLoadingPermit2Ref.current) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const transactions: `0x${string}`[] = [];

    const initialStep = usePermit2Setting
      ? (permit2Authorized
        ? (isBundlerAuthorized ? 'sign_permit' : 'authorize_bundler_sig')
        : 'approve_permit2')
      : (isBundlerAuthorized
        ? (isTokenApproved ? 'execute' : 'approve_token')
        : 'authorize_bundler_tx');
    tracking.start(
      getStepsForFlow(usePermit2Setting),
      {
        title: 'Smart Rebalance',
        description: `Smart rebalancing ${groupedPosition.loanAsset} positions`,
        tokenSymbol: groupedPosition.loanAsset,
        summaryItems,
      },
      initialStep,
    );

    try {
      const { withdrawTxs, supplyTxs } = generateSmartRebalanceTxData();

      // Build fee sweep tx: erc20Transfer(asset, feeRecipient, maxUint256) to sweep all remaining
      const feeTransferTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'erc20Transfer',
        args: [groupedPosition.loanAssetAddress as Address, FEE_RECIPIENT, maxUint256],
      });

      let multicallGas: bigint | undefined = undefined;

      if (usePermit2Setting) {
        // --- Permit2 Flow ---
        tracking.update('approve_permit2');
        if (!permit2AuthorizedRef.current) {
          await authorizePermit2();
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        tracking.update('authorize_bundler_sig');
        const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
        if (authorizationTxData) {
          transactions.push(authorizationTxData);
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        tracking.update('sign_permit');
        const { sigs, permitSingle } = await signForBundlers();
        const permitTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'approve2',
          args: [permitSingle, sigs, false],
        });
        const transferFromTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'transferFrom2',
          args: [groupedPosition.loanAssetAddress as Address, totalMoved],
        });

        // Bundle order: auth → withdraws → transferFrom → supplies → fee sweep
        transactions.push(permitTx);
        transactions.push(...withdrawTxs);
        transactions.push(transferFromTx);
        transactions.push(...supplyTxs);
        transactions.push(feeTransferTx);
      } else {
        // --- Standard ERC20 Flow ---
        tracking.update('authorize_bundler_tx');
        const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
        if (!authorized) {
          throw new Error('Failed to authorize Bundler via transaction.');
        }

        tracking.update('approve_token');
        if (!isTokenApproved) {
          await approveToken();
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const erc20TransferFromTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'erc20TransferFrom',
          args: [groupedPosition.loanAssetAddress as Address, totalMoved],
        });

        // Bundle order: withdraws → transferFrom → supplies → fee sweep
        transactions.push(...withdrawTxs);
        transactions.push(erc20TransferFromTx);
        transactions.push(...supplyTxs);
        transactions.push(feeTransferTx);

        // Estimate gas
        multicallGas = GAS_COSTS.BUNDLER_REBALANCE;
        if (supplyTxs.length > 1) {
          multicallGas += GAS_COSTS.SINGLE_SUPPLY * BigInt(supplyTxs.length - 1);
        }
        if (withdrawTxs.length > 1) {
          multicallGas += GAS_COSTS.SINGLE_WITHDRAW * BigInt(withdrawTxs.length - 1);
        }
      }

      // Execute multicall
      tracking.update('execute');
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
        gas: multicallGas ? (multicallGas * GAS_MULTIPLIER_NUMERATOR) / GAS_MULTIPLIER_DENOMINATOR : undefined,
      });

      tracking.complete();
      return true;
    } catch (error: unknown) {
      console.error('Error during smart rebalance:', error);
      tracking.fail();

      const isUserRejection = (() => {
        if (error && typeof error === 'object') {
          const err = error as Record<string, unknown>;
          if (err.code === 4001 || err.code === 'ACTION_REJECTED') return true;
          const msg = typeof err.message === 'string' ? err.message : '';
          if (/user rejected|user denied|request has been rejected/i.test(msg)) return true;
          const nested = (err.data as Record<string, unknown>)?.originalError as Record<string, unknown> | undefined;
          if (nested?.code === 4001) return true;
          const cause = err.cause as Record<string, unknown> | undefined;
          if (cause?.code === 4001 || cause?.code === 'ACTION_REJECTED') return true;
        }
        return false;
      })();

      if (isUserRejection) {
        toast.error('Transaction Rejected', 'User rejected transaction.');
      } else {
        toast.error('Smart Rebalance Failed', 'An unexpected error occurred during smart rebalance.');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    account,
    result,
    totalMoved,
    hasBundler,
    usePermit2Setting,
    isBundlerAuthorized,
    authorizePermit2,
    ensureBundlerAuthorization,
    signForBundlers,
    isTokenApproved,
    approveToken,
    generateSmartRebalanceTxData,
    sendTransactionAsync,
    bundlerAddress,
    groupedPosition.chainId,
    groupedPosition.loanAssetAddress,
    groupedPosition.loanAsset,
    toast,
    tracking,
    getStepsForFlow,
  ]);

  const isLoading = isProcessing || isLoadingPermit2 || isTokenApproving || isAuthorizingBundler || isExecuting;

  return {
    executeSmartRebalance,
    isProcessing: isLoading,
    totalMoved,
    feeAmount,
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as SmartRebalanceStepType | null,
  };
};

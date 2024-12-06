import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Address, encodeFunctionData, maxUint256, parseSignature } from 'viem';
import { useAccount, useReadContract, useSignTypedData } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import morphoAbi from '@/abis/morpho';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { getBundlerV2, MONARCH_TX_IDENTIFIER, MORPHO } from '@/utils/morpho';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import { usePermit2 } from './usePermit2';

export const useRebalance = (groupedPosition: GroupedPosition, onRebalance?: () => void) => {
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState<
    'idle' | 'approve' | 'authorize' | 'sign' | 'execute'
  >('idle');

  const { address: account } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const bundlerAddress = getBundlerV2(groupedPosition.chainId);

  const { data: isAuthorized } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'isAuthorized',
    args: [account as Address, bundlerAddress as Address],
    chainId: groupedPosition.chainId,
  });

  const { data: nonce } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'nonce',
    args: [account as Address],
    chainId: groupedPosition.chainId,
  });

  const totalAmount = rebalanceActions.reduce(
    (acc, action) => acc + BigInt(action.amount),
    BigInt(0),
  );

  const { authorizePermit2, permit2Authorized, signForBundlers } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(groupedPosition.chainId),
    token: groupedPosition.loanAssetAddress as `0x${string}`,
    refetchInterval: 10000,
    chainId: groupedPosition.chainId,
    tokenSymbol: groupedPosition.loanAsset,
    amount: totalAmount,
  });

  const addRebalanceAction = useCallback((action: RebalanceAction) => {
    setRebalanceActions((prev) => [...prev, action]);
  }, []);

  const removeRebalanceAction = useCallback((index: number) => {
    setRebalanceActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const { sendTransactionAsync } = useTransactionWithToast({
    toastId: 'rebalance',
    pendingText: 'Rebalancing positions',
    successText: 'Positions rebalanced successfully',
    errorText: 'Failed to rebalance positions',
    chainId: groupedPosition.chainId,
    onSuccess: onRebalance,
  });

  const executeRebalance = useCallback(async () => {
    if (!account) {
      return;
    }
    setIsConfirming(true);
    const transactions: `0x${string}`[] = [];

    try {
      // Step 1: Authorize Permit2 if needed
      setCurrentStep('approve');
      if (!permit2Authorized) {
        await authorizePermit2();

        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Step 2: Sign and authorize bundler if needed
      setCurrentStep('authorize');
      if (isAuthorized === false) {
        const domain = {
          chainId: groupedPosition.chainId,
          verifyingContract: MORPHO as Address,
        };

        const types = {
          Authorization: [
            { name: 'authorizer', type: 'address' },
            { name: 'authorized', type: 'address' },
            { name: 'isAuthorized', type: 'bool' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        };

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const value = {
          authorizer: account,
          authorized: bundlerAddress,
          isAuthorized: true,
          nonce: nonce,
          deadline: BigInt(deadline),
        };

        let signatureRaw;
        try {
          signatureRaw = await signTypedDataAsync({
            domain,
            types,
            primaryType: 'Authorization',
            message: value,
          });
        } catch (error) {
          toast.error('Signature request was rejected or failed. Please try again.');
          return;
        }
        const signature = parseSignature(signatureRaw);

        const authorizationTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoSetAuthorizationWithSig',
          args: [
            {
              authorizer: account as Address,
              authorized: bundlerAddress,
              isAuthorized: true,
              nonce: BigInt(nonce ?? 0),
              deadline: BigInt(deadline),
            },
            {
              v: Number(signature.v),
              r: signature.r,
              s: signature.s,
            },
            false,
          ],
        });

        transactions.push(authorizationTx);

        // wait 800ms to avoid rabby wallet issue
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Step 3: Sign permit for USDC
      setCurrentStep('sign');
      const { sigs, permitSingle } = await signForBundlers();
      console.log('Signed for bundlers:', { sigs, permitSingle });

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

      // don't push the transferFromTx to the array, do it after all withdrawals. Here we only dealt with permit
      transactions.push(permitTx);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 4: Append rebalance actions and generate tx
      setCurrentStep('execute');

      const withdrawTxs: `0x${string}`[] = [];
      const supplyTxs: `0x${string}`[] = [];

      // Group actions by market
      const groupedWithdraws: Record<string, RebalanceAction[]> = {};
      const groupedSupplies: Record<string, RebalanceAction[]> = {};

      rebalanceActions.forEach((action) => {
        const withdrawKey = action.fromMarket.uniqueKey;
        const supplyKey = action.toMarket.uniqueKey;

        if (!groupedWithdraws[withdrawKey]) groupedWithdraws[withdrawKey] = [];
        if (!groupedSupplies[supplyKey]) groupedSupplies[supplyKey] = [];

        groupedWithdraws[withdrawKey].push(action);
        groupedSupplies[supplyKey].push(action);
      });

      // Generate batched withdraw transactions
      Object.values(groupedWithdraws).forEach((actions) => {
        const batchAmount = actions.reduce((sum, action) => sum + BigInt(action.amount), BigInt(0));

        // if any of the action has `isMax`,
        const isWithdrawMax = actions.some((action) => action.isMax);
        // if any action is max, there must be a "share" set
        const shares = groupedPosition.markets.find(
          (m) => m.market.uniqueKey === actions[0].fromMarket.uniqueKey,
        )?.supplyShares;

        console.log('shares', shares);

        if (isWithdrawMax && shares === undefined) {
          throw new Error('No share found for max withdraw');
        }

        const market = actions[0].fromMarket;

        const withdrawTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoWithdraw',
          args: [
            {
              loanToken: market.loanToken as Address,
              collateralToken: market.collateralToken as Address,
              oracle: market.oracle as Address,
              irm: market.irm as Address,
              lltv: BigInt(market.lltv),
            },
            isWithdrawMax ? BigInt(0) : batchAmount, // assets
            isWithdrawMax ? BigInt(shares as string) : BigInt(0), // shares
            isWithdrawMax ? batchAmount : maxUint256, // slippage: max: minWithdraw => max share burned
            account, // receiver
          ],
        });

        withdrawTxs.push(withdrawTx);
      });

      // Generate batched supply transactions
      Object.values(groupedSupplies).forEach((actions) => {
        const bachedAmount = actions.reduce(
          (sum, action) => sum + BigInt(action.amount),
          BigInt(0),
        );
        const market = actions[0].toMarket;

        const supplyTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoSupply',
          args: [
            {
              loanToken: market.loanToken as Address,
              collateralToken: market.collateralToken as Address,
              oracle: market.oracle as Address,
              irm: market.irm as Address,
              lltv: BigInt(market.lltv),
            },
            bachedAmount,
            BigInt(0),
            BigInt(0), // slippageAmount => min share minted
            account,
            '0x',
          ],
        });

        supplyTxs.push(supplyTx);
      });

      // Reorder transactions
      transactions.push(...withdrawTxs);
      transactions.push(transferFromTx);
      transactions.push(...supplyTxs);

      // Execute all transactions
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
      });

      setRebalanceActions([]);
    } catch (error) {
      console.error('Error during rebalance:', error);
      toast.error('An error occurred during rebalance. Please try again.');
      throw error;
    } finally {
      setIsConfirming(false);
      setCurrentStep('idle');
    }
  }, [
    account,
    permit2Authorized,
    authorizePermit2,
    signForBundlers,
    isAuthorized,
    nonce,
    bundlerAddress,
    groupedPosition.chainId,
    signTypedDataAsync,
    rebalanceActions,
    sendTransactionAsync,
    groupedPosition.loanAssetAddress,
    totalAmount,
  ]);

  return {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isConfirming,
    currentStep,
    isAuthorized: permit2Authorized,
  };
};

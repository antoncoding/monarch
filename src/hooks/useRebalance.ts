import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAccount, useReadContract, useSignTypedData } from 'wagmi';
import { usePermit2 } from './usePermit2';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import morphoBundlerAbi from '@/abis/bundlerV2';
import morphoAbi from '@/abis/morpho';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { getBundlerV2, MORPHO } from '@/utils/morpho';
import { Address, encodeFunctionData, maxUint256, parseSignature } from 'viem';

export const useRebalance = (groupedPosition: GroupedPosition) => {
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'approve' | 'authorize' | 'sign' | 'execute'>('idle');

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

  const totalAmount = rebalanceActions.reduce((acc, action) => acc + BigInt(action.amount), BigInt(0));

  const {
    authorizePermit2,
    permit2Authorized,
    signForBundlers,
  } = usePermit2({
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
  });

  const executeRebalance = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
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
      transactions.push(permitTx);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 4: Append rebalance actions and generate tx
      setCurrentStep('execute');

      const rebalanceTxs = rebalanceActions.flatMap((action) => {
        console.log('action', action.amount.toString());
        const withdrawTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoWithdraw',
          args: [
            {
              loanToken: action.fromMarket.loanToken as Address,
              collateralToken: action.fromMarket.collateralToken as Address,
              oracle: action.fromMarket.oracle as Address,
              irm: action.fromMarket.irm as Address,
              lltv: BigInt(action.fromMarket.lltv),
            },
            action.amount, // assets
            BigInt(0), // shares
            maxUint256, // slippageAmount => max share burned
            account, // receiver
          ],
        });

        const supplyTx = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoSupply',
          args: [
            {
              loanToken: action.toMarket.loanToken as Address,
              collateralToken: action.toMarket.collateralToken as Address,
              oracle: action.toMarket.oracle as Address,
              irm: action.toMarket.irm as Address,
              lltv: BigInt(action.toMarket.lltv),
            },
            action.amount,
            BigInt(0),
            BigInt(0), // slippageAmount => min share minted
            account,
            '0x',
          ],
        });

        return [withdrawTx, supplyTx];
      });
      transactions.push(...rebalanceTxs);

      console.log('transactions', transactions);


      // Execute all transactions
      const multicallTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'multicall',
        args: [transactions],
      });

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
  }, [account, permit2Authorized, authorizePermit2, signForBundlers, isAuthorized, nonce, bundlerAddress, groupedPosition.chainId, signTypedDataAsync, rebalanceActions, sendTransactionAsync]);

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
import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData, Address, parseSignature, maxUint256 } from 'viem';
import { useAccount, useReadContract, useSignTypedData } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import morphoAbi from '@/abis/morpho';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { getBundlerV2, MORPHO } from '@/utils/morpho';
import { RebalanceAction, GroupedPosition } from '@/utils/types';

export function useRebalance(groupedPosition: GroupedPosition) {
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const { address: account } = useAccount();
  const bundlerAddress = getBundlerV2(groupedPosition.chainId);

  const { data: isAuthorized } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'isAuthorized',
    args: [account as Address, bundlerAddress as Address],
  });

  const { data: nonce } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'nonce',
    args: [account as Address],
  });

  const { signTypedDataAsync } = useSignTypedData();

  const { isConfirming, sendTransaction } = useTransactionWithToast({
    toastId: 'rebalance',
    pendingText: 'Rebalancing positions',
    successText: 'Positions rebalanced successfully',
    errorText: 'Failed to rebalance positions',
    chainId: groupedPosition.chainId,
  });

  const addRebalanceAction = useCallback((action: RebalanceAction) => {
    setRebalanceActions((prev) => [...prev, action]);
  }, []);

  const removeRebalanceAction = useCallback((index: number) => {
    setRebalanceActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const executeRebalance = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    const transactions = [] as `0x${string}`[];

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
            authorizer: account,
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

      // Wait for 0.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('rebalanceActions', rebalanceActions);

    const totalAmount = rebalanceActions.reduce(
      (acc, action) => acc + BigInt(action.amount),
      BigInt(0),
    );
    console.log('permitting totalAmount', totalAmount.toString());

    const rebalanceTxs = rebalanceActions.flatMap((action) => {
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
          BigInt(action.amount), // assets
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
          BigInt(action.amount),
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

    const multicallTx = encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'multicall',
      args: [transactions],
    });

    sendTransaction({
      account,
      to: bundlerAddress,
      data: multicallTx,
      chainId: groupedPosition.chainId,
    });
  }, [
    account,
    isAuthorized,
    nonce,
    bundlerAddress,
    groupedPosition.chainId,
    rebalanceActions,
    sendTransaction,
    signTypedDataAsync,
  ]);

  return {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isConfirming,
    isAuthorized,
  };
}
